package com.purchasesale.sqlite;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * SQLite connection seam. The Xerial SQLite JDBC driver is loaded at runtime
 * so the project remains compilable before the deployment dependency is added.
 */
public final class SQLiteDatabase implements AutoCloseable {
    private final Connection connection;

    private SQLiteDatabase(Connection connection) {
        this.connection = connection;
    }

    public static SQLiteDatabase open(Path file) throws SQLException {
        if (file == null) throw new IllegalArgumentException("SQLite database path is required");
        Path parent = file.toAbsolutePath().getParent();
        try {
            if (parent != null) Files.createDirectories(parent);
        } catch (java.io.IOException error) {
            throw new IllegalStateException("Cannot create database directory", error);
        }
        try {
            Class.forName("org.sqlite.JDBC");
        } catch (ClassNotFoundException error) {
            throw new IllegalStateException("SQLite JDBC driver is missing from the classpath", error);
        }
        SQLiteDatabase database = new SQLiteDatabase(DriverManager.getConnection("jdbc:sqlite:" + file.toAbsolutePath()));
        database.initializeSchema();
        return database;
    }

    public Connection connection() { return connection; }

    public String integrityCheck() throws SQLException {
        Statement statement = connection.createStatement();
        ResultSet result = statement.executeQuery("PRAGMA integrity_check");
        String message = result.next() ? result.getString(1) : "no result";
        result.close();
        statement.close();
        return message;
    }

    /** Creates a consistent SQLite snapshot without asking the user to copy a live database file. */
    public void backupTo(Path target) throws SQLException {
        if (target == null) throw new IllegalArgumentException("Backup path is required");
        try {
            Path absolute = target.toAbsolutePath();
            if (absolute.getParent() != null) Files.createDirectories(absolute.getParent());
            String filename = absolute.toString().replace("'", "''");
            Statement statement = connection.createStatement();
            statement.execute("VACUUM INTO '" + filename + "'");
            statement.close();
        } catch (java.io.IOException error) {
            throw new SQLException("Cannot create backup directory", error);
        }
    }

    private void initializeSchema() throws SQLException {
        Statement statement = connection.createStatement();
        statement.executeUpdate("PRAGMA foreign_keys = ON");
        statement.executeUpdate("CREATE TABLE IF NOT EXISTS company_profile (id INTEGER PRIMARY KEY CHECK(id = 1), name TEXT NOT NULL, address TEXT NOT NULL, phone TEXT NOT NULL, fiscal_year TEXT NOT NULL, logo_path TEXT NOT NULL)");
        statement.executeUpdate("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, permissions TEXT NOT NULL)");
        statement.executeUpdate("CREATE TABLE IF NOT EXISTS accounts (code TEXT PRIMARY KEY, description TEXT NOT NULL, parent_code TEXT, opening_balance NUMERIC NOT NULL DEFAULT 0, FOREIGN KEY(parent_code) REFERENCES accounts(code))");
        statement.executeUpdate("CREATE TABLE IF NOT EXISTS items (code TEXT PRIMARY KEY, description TEXT NOT NULL, unit TEXT NOT NULL, sale_rate NUMERIC NOT NULL, purchase_rate NUMERIC NOT NULL, stock_type TEXT NOT NULL)");
        statement.executeUpdate("CREATE TABLE IF NOT EXISTS stock_types (code TEXT PRIMARY KEY, description TEXT NOT NULL)");
        statement.executeUpdate("INSERT OR IGNORE INTO stock_types(code, description) VALUES ('REG', 'Regular')");
        statement.executeUpdate("INSERT OR IGNORE INTO stock_types(code, description) VALUES ('SER', 'Service')");
        statement.executeUpdate("CREATE TABLE IF NOT EXISTS banks (code TEXT PRIMARY KEY, name TEXT NOT NULL, account_number TEXT, opening_balance NUMERIC NOT NULL DEFAULT 0, address TEXT, phone TEXT)");
        statement.executeUpdate("CREATE TABLE IF NOT EXISTS cheques (number TEXT PRIMARY KEY, bank_code TEXT NOT NULL, cheque_date TEXT NOT NULL, party TEXT NOT NULL, amount NUMERIC NOT NULL, status TEXT NOT NULL, manual_id TEXT, FOREIGN KEY(bank_code) REFERENCES banks(code))");
        // Older databases created the cheques table without manual_id; add it when missing.
        try { statement.executeUpdate("ALTER TABLE cheques ADD COLUMN manual_id TEXT"); } catch (SQLException ignored) { /* column already exists */ }
        statement.executeUpdate("CREATE TABLE IF NOT EXISTS cheque_status_history (id INTEGER PRIMARY KEY AUTOINCREMENT, cheque_number TEXT NOT NULL, status TEXT NOT NULL, changed_at TEXT NOT NULL, FOREIGN KEY(cheque_number) REFERENCES cheques(number))");
        statement.executeUpdate("CREATE TABLE IF NOT EXISTS audit_events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_time TEXT NOT NULL, username TEXT NOT NULL, action TEXT NOT NULL, details TEXT NOT NULL)");
        statement.executeUpdate("CREATE TABLE IF NOT EXISTS challans (number TEXT PRIMARY KEY, type TEXT NOT NULL, date TEXT NOT NULL, party TEXT NOT NULL, location TEXT NOT NULL, total NUMERIC NOT NULL)");
        statement.executeUpdate("CREATE TABLE IF NOT EXISTS challan_lines (challan_number TEXT NOT NULL, line_number INTEGER NOT NULL, item_code TEXT NOT NULL, quantity NUMERIC NOT NULL, rate NUMERIC NOT NULL, amount NUMERIC NOT NULL, PRIMARY KEY(challan_number, line_number), FOREIGN KEY(challan_number) REFERENCES challans(number), FOREIGN KEY(item_code) REFERENCES items(code))");
        statement.executeUpdate("CREATE TABLE IF NOT EXISTS vouchers (number TEXT PRIMARY KEY, date TEXT NOT NULL, narration TEXT, reference TEXT)");
        statement.executeUpdate("CREATE TABLE IF NOT EXISTS voucher_lines (voucher_number TEXT NOT NULL, line_number INTEGER NOT NULL, account_code TEXT NOT NULL, debit NUMERIC NOT NULL, credit NUMERIC NOT NULL, PRIMARY KEY(voucher_number, line_number), FOREIGN KEY(voucher_number) REFERENCES vouchers(number), FOREIGN KEY(account_code) REFERENCES accounts(code))");
        statement.executeUpdate("CREATE TABLE IF NOT EXISTS stock_movements (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, document TEXT NOT NULL, type TEXT NOT NULL, item_code TEXT NOT NULL, location TEXT NOT NULL, quantity NUMERIC NOT NULL, rate NUMERIC NOT NULL, amount NUMERIC NOT NULL, FOREIGN KEY(item_code) REFERENCES items(code))");
        statement.executeUpdate("CREATE TABLE IF NOT EXISTS sync_operations (operation_id TEXT PRIMARY KEY, origin_device TEXT NOT NULL, sequence_number INTEGER NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, operation_type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, content_hash TEXT NOT NULL)");
        statement.executeUpdate("CREATE TABLE IF NOT EXISTS sync_conflicts (conflict_id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, local_operation_id TEXT NOT NULL, remote_operation_id TEXT NOT NULL, status TEXT NOT NULL, local_payload TEXT NOT NULL, remote_payload TEXT NOT NULL, created_at TEXT NOT NULL)");
        statement.close();
    }

    @Override public void close() throws SQLException { connection.close(); }
}
