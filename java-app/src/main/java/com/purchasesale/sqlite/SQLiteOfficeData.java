package com.purchasesale.sqlite;

import com.purchasesale.domain.AccountRepository;
import com.purchasesale.domain.BankRepository;
import com.purchasesale.domain.Challan;
import com.purchasesale.domain.ChallanRepository;
import com.purchasesale.domain.CompanyProfileRepository;
import com.purchasesale.domain.ChequeRepository;
import com.purchasesale.domain.ItemRepository;
import com.purchasesale.domain.StockMovementRepository;
import com.purchasesale.domain.VoucherRepository;
import com.purchasesale.domain.UserAccountRepository;
import java.nio.file.Path;
import java.sql.SQLException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.text.SimpleDateFormat;
import java.util.Date;

/** Owns one SQLite connection and all repositories backed by it. */
public final class SQLiteOfficeData implements AutoCloseable {
    private final SQLiteDatabase database;
    private final AccountRepository accounts;
    private final BankRepository banks;
    private final ItemRepository items;
    private final ChallanRepository challans;
    private final VoucherRepository vouchers;
    private final StockMovementRepository stockMovements;
    private final CompanyProfileRepository companyProfile;
    private final ChequeRepository cheques;
    private final UserAccountRepository users;

    private SQLiteOfficeData(SQLiteDatabase database) {
        this.database = database;
        this.accounts = new SQLiteAccountRepository(database);
        this.banks = new SQLiteBankRepository(database);
        this.items = new SQLiteItemRepository(database);
        this.challans = new SQLiteChallanRepository(database);
        this.vouchers = new SQLiteVoucherRepository(database);
        this.stockMovements = new SQLiteStockMovementRepository(database);
        this.companyProfile = new SQLiteCompanyProfileRepository(database);
        this.cheques = new SQLiteChequeRepository(database);
        this.users = new SQLiteUserAccountRepository(database);
    }

    public static SQLiteOfficeData open(Path file) throws SQLException { return new SQLiteOfficeData(SQLiteDatabase.open(file)); }
    public AccountRepository accounts() { return accounts; }
    public BankRepository banks() { return banks; }
    public ItemRepository items() { return items; }
    public ChallanRepository challans() { return challans; }
    public VoucherRepository vouchers() { return vouchers; }
    public StockMovementRepository stockMovements() { return stockMovements; }
    public CompanyProfileRepository companyProfile() { return companyProfile; }
    public ChequeRepository cheques() { return cheques; }
    public UserAccountRepository users() { return users; }
    public void backupTo(Path target) throws SQLException { database.backupTo(target); }
    public String integrityCheck() throws SQLException { return database.integrityCheck(); }
    public void recordAudit(String username, String action, String details) throws SQLException {
        PreparedStatement statement = database.connection().prepareStatement("INSERT INTO audit_events(event_time, username, action, details) VALUES (?, ?, ?, ?)");
        statement.setString(1, new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date()));
        statement.setString(2, username == null ? "system" : username);
        statement.setString(3, action);
        statement.setString(4, details == null ? "" : details);
        statement.executeUpdate(); statement.close();
    }
    public List<String[]> auditEvents() throws SQLException {
        List<String[]> result = new ArrayList<String[]>();
        ResultSet rows = database.connection().createStatement().executeQuery("SELECT event_time, username, action, details FROM audit_events ORDER BY id DESC");
        while (rows.next()) result.add(new String[] {rows.getString(1), rows.getString(2), rows.getString(3), rows.getString(4)});
        rows.close(); return result;
    }
    public List<String[]> stockTypes() {
        List<String[]> result = new ArrayList<String[]>();
        try {
            ResultSet rows = database.connection().createStatement().executeQuery("SELECT code, description FROM stock_types ORDER BY code");
            while (rows.next()) result.add(new String[] {rows.getString(1), rows.getString(2)});
            rows.close();
            return result;
        } catch (SQLException error) { throw new IllegalArgumentException("Cannot load stock types: " + error.getMessage(), error); }
    }
    public void saveStockType(String code, String description) {
        try {
            PreparedStatement statement = database.connection().prepareStatement("INSERT INTO stock_types(code, description) VALUES (?, ?)");
            statement.setString(1, code); statement.setString(2, description); statement.executeUpdate(); statement.close();
        } catch (SQLException error) { throw new IllegalArgumentException("Cannot save stock type: " + error.getMessage(), error); }
    }
    public void saveChallanAndMovements(Challan challan) {
        Connection connection = database.connection();
        try {
            connection.setAutoCommit(false);
            PreparedStatement header = connection.prepareStatement("INSERT INTO challans(number, type, date, party, location, total) VALUES (?, ?, ?, ?, ?, ?)");
            header.setString(1, challan.getNumber()); header.setString(2, challan.getType().name()); header.setString(3, challan.getDate());
            header.setString(4, challan.getParty()); header.setString(5, challan.getLocation()); header.setBigDecimal(6, challan.total());
            header.executeUpdate(); header.close();

            PreparedStatement line = connection.prepareStatement("INSERT INTO challan_lines(challan_number, line_number, item_code, quantity, rate, amount) VALUES (?, ?, ?, ?, ?, ?)");
            PreparedStatement movement = connection.prepareStatement("INSERT INTO stock_movements(date, document, type, item_code, location, quantity, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            int lineNo = 1;
            for (Challan.Line value : challan.getLines()) {
                java.math.BigDecimal stockQuantity = challan.getType() == Challan.Type.PURCHASE ? value.getQuantity() : value.getQuantity().negate();
                line.setString(1, challan.getNumber()); line.setInt(2, lineNo++); line.setString(3, value.getItemCode());
                line.setBigDecimal(4, value.getQuantity()); line.setBigDecimal(5, value.getRate()); line.setBigDecimal(6, value.amount()); line.addBatch();
                movement.setString(1, challan.getDate()); movement.setString(2, challan.getNumber()); movement.setString(3, challan.getType().name());
                movement.setString(4, value.getItemCode()); movement.setString(5, challan.getLocation()); movement.setBigDecimal(6, stockQuantity);
                movement.setBigDecimal(7, value.getRate()); movement.setBigDecimal(8, stockQuantity.multiply(value.getRate())); movement.addBatch();
            }
            line.executeBatch(); movement.executeBatch(); line.close(); movement.close();
            connection.commit(); connection.setAutoCommit(true);
        } catch (SQLException error) {
            try { connection.rollback(); connection.setAutoCommit(true); } catch (SQLException ignored) { }
            throw new IllegalArgumentException("Cannot save challan and stock movements: " + error.getMessage(), error);
        }
    }
    @Override public void close() throws SQLException { database.close(); }
}
