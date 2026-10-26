package com.purchasesale.sqlite;

import com.purchasesale.domain.JournalVoucher;
import com.purchasesale.domain.PostedVoucher;
import com.purchasesale.domain.VoucherRepository;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public final class SQLiteVoucherRepository implements VoucherRepository {
    private final SQLiteDatabase database;
    public SQLiteVoucherRepository(SQLiteDatabase database) { this.database = database; }
    @Override public void save(PostedVoucher voucher) {
        Connection connection = database.connection();
        try {
            connection.setAutoCommit(false);
            PreparedStatement header = connection.prepareStatement("INSERT INTO vouchers(number, date, narration, reference) VALUES (?, ?, ?, ?)"); header.setString(1, voucher.getNumber()); header.setString(2, voucher.getDate()); header.setString(3, voucher.getNarration()); header.setString(4, voucher.getReference()); header.executeUpdate(); header.close();
            PreparedStatement line = connection.prepareStatement("INSERT INTO voucher_lines(voucher_number, line_number, account_code, debit, credit) VALUES (?, ?, ?, ?, ?)"); int number = 1;
            for (JournalVoucher.JournalLine value : voucher.lines()) { line.setString(1, voucher.getNumber()); line.setInt(2, number++); line.setString(3, value.getAccountCode()); line.setBigDecimal(4, value.getDebit()); line.setBigDecimal(5, value.getCredit()); line.addBatch(); }
            line.executeBatch(); line.close(); connection.commit(); connection.setAutoCommit(true);
        } catch (SQLException error) { rollback(connection); throw failure("Cannot save voucher", error); }
    }
    @Override public List<PostedVoucher> findAll() {
        List<PostedVoucher> result = new ArrayList<PostedVoucher>();
        try { ResultSet rows = database.connection().createStatement().executeQuery("SELECT number, date, narration, reference FROM vouchers ORDER BY date, number"); while (rows.next()) result.add(read(rows)); rows.close(); return result; }
        catch (SQLException error) { throw failure("Cannot load vouchers", error); }
    }
    private PostedVoucher read(ResultSet row) throws SQLException {
        JournalVoucher journal = new JournalVoucher(); PreparedStatement statement = database.connection().prepareStatement("SELECT account_code, debit, credit FROM voucher_lines WHERE voucher_number = ? ORDER BY line_number"); statement.setString(1, row.getString(1)); ResultSet values = statement.executeQuery(); while (values.next()) journal.add(values.getString(1), values.getBigDecimal(2), values.getBigDecimal(3)); values.close(); statement.close(); return new PostedVoucher(row.getString(1), row.getString(2), row.getString(3), row.getString(4), journal);
    }
    private void rollback(Connection connection) { try { connection.rollback(); connection.setAutoCommit(true); } catch (SQLException ignored) { } }
    private IllegalArgumentException failure(String message, SQLException error) { return new IllegalArgumentException(message + ": " + error.getMessage(), error); }
}
