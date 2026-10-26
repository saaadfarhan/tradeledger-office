package com.purchasesale.sqlite;

import com.purchasesale.domain.Cheque;
import com.purchasesale.domain.ChequeRepository;
import com.purchasesale.domain.ChequeStatusChange;
import java.sql.PreparedStatement;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Date;
import java.text.SimpleDateFormat;

public final class SQLiteChequeRepository implements ChequeRepository {
    private final SQLiteDatabase database;
    public SQLiteChequeRepository(SQLiteDatabase database) { this.database = database; }
    @Override public List<Cheque> findAll() {
        List<Cheque> result = new ArrayList<Cheque>();
        try { ResultSet rows = database.connection().createStatement().executeQuery("SELECT number, bank_code, cheque_date, party, amount, status, manual_id FROM cheques ORDER BY cheque_date, number"); while (rows.next()) result.add(new Cheque(rows.getString(1), rows.getString(2), rows.getString(3), rows.getString(4), rows.getBigDecimal(5), rows.getString(6), rows.getString(7))); rows.close(); return result; }
        catch (SQLException error) { throw failure("Cannot load cheques", error); }
    }
    @Override public void save(Cheque cheque) {
        Connection connection = database.connection();
        try {
            connection.setAutoCommit(false);
            PreparedStatement statement = connection.prepareStatement("INSERT INTO cheques(number, bank_code, cheque_date, party, amount, status, manual_id) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(number) DO UPDATE SET bank_code=excluded.bank_code, cheque_date=excluded.cheque_date, party=excluded.party, amount=excluded.amount, status=excluded.status, manual_id=excluded.manual_id");
            statement.setString(1, cheque.getNumber()); statement.setString(2, cheque.getBankCode()); statement.setString(3, cheque.getDate()); statement.setString(4, cheque.getParty()); statement.setBigDecimal(5, cheque.getAmount()); statement.setString(6, cheque.getStatus()); statement.setString(7, cheque.getManualId()); statement.executeUpdate(); statement.close();
            PreparedStatement history = connection.prepareStatement("INSERT INTO cheque_status_history(cheque_number, status, changed_at) VALUES (?, ?, ?)");
            history.setString(1, cheque.getNumber()); history.setString(2, cheque.getStatus()); history.setString(3, now()); history.executeUpdate(); history.close();
            connection.commit(); connection.setAutoCommit(true);
        } catch (SQLException error) {
            try { connection.rollback(); connection.setAutoCommit(true); } catch (SQLException ignored) { }
            throw failure("Cannot save cheque", error);
        }
    }

    @Override public List<ChequeStatusChange> history(String chequeNumber) {
        List<ChequeStatusChange> result = new ArrayList<ChequeStatusChange>();
        try { PreparedStatement statement = database.connection().prepareStatement("SELECT cheque_number, status, changed_at FROM cheque_status_history WHERE cheque_number = ? ORDER BY id"); statement.setString(1, chequeNumber); ResultSet rows = statement.executeQuery(); while (rows.next()) result.add(new ChequeStatusChange(rows.getString(1), rows.getString(2), rows.getString(3))); rows.close(); statement.close(); return result; }
        catch (SQLException error) { throw failure("Cannot load cheque history", error); }
    }
    private String now() { return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date()); }
    private IllegalArgumentException failure(String message, SQLException error) { return new IllegalArgumentException(message + ": " + error.getMessage(), error); }
}
