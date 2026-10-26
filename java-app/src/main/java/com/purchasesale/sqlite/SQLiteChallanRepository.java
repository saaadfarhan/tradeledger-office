package com.purchasesale.sqlite;

import com.purchasesale.domain.Challan;
import com.purchasesale.domain.ChallanRepository;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public final class SQLiteChallanRepository implements ChallanRepository {
    private final SQLiteDatabase database;
    public SQLiteChallanRepository(SQLiteDatabase database) { this.database = database; }
    @Override public void save(Challan challan) {
        Connection connection = database.connection();
        try {
            connection.setAutoCommit(false);
            PreparedStatement header = connection.prepareStatement("INSERT INTO challans(number, type, date, party, location, total) VALUES (?, ?, ?, ?, ?, ?)");
            header.setString(1, challan.getNumber()); header.setString(2, challan.getType().name()); header.setString(3, challan.getDate()); header.setString(4, challan.getParty()); header.setString(5, challan.getLocation()); header.setBigDecimal(6, challan.total()); header.executeUpdate(); header.close();
            PreparedStatement line = connection.prepareStatement("INSERT INTO challan_lines(challan_number, line_number, item_code, quantity, rate, amount) VALUES (?, ?, ?, ?, ?, ?)");
            int number = 1;
            for (Challan.Line value : challan.getLines()) { line.setString(1, challan.getNumber()); line.setInt(2, number++); line.setString(3, value.getItemCode()); line.setBigDecimal(4, value.getQuantity()); line.setBigDecimal(5, value.getRate()); line.setBigDecimal(6, value.amount()); line.addBatch(); }
            line.executeBatch(); line.close(); connection.commit(); connection.setAutoCommit(true);
        } catch (SQLException error) { rollback(connection); throw failure("Cannot save challan", error); }
    }
    @Override public boolean containsNumber(String number) {
        try { PreparedStatement statement = database.connection().prepareStatement("SELECT 1 FROM challans WHERE number = ?"); statement.setString(1, number); ResultSet rows = statement.executeQuery(); boolean found = rows.next(); rows.close(); statement.close(); return found; }
        catch (SQLException error) { throw failure("Cannot search challans", error); }
    }
    @Override public List<Challan> findAll() {
        List<Challan> result = new ArrayList<Challan>();
        try { ResultSet rows = database.connection().createStatement().executeQuery("SELECT number, type, date, party, location FROM challans ORDER BY date, number"); while (rows.next()) result.add(read(rows)); rows.close(); return result; }
        catch (SQLException error) { throw failure("Cannot load challans", error); }
    }
    private Challan read(ResultSet row) throws SQLException {
        List<Challan.Line> lines = new ArrayList<Challan.Line>();
        PreparedStatement statement = database.connection().prepareStatement("SELECT item_code, quantity, rate FROM challan_lines WHERE challan_number = ? ORDER BY line_number"); statement.setString(1, row.getString(1)); ResultSet values = statement.executeQuery(); while (values.next()) lines.add(new Challan.Line(values.getString(1), values.getBigDecimal(2), values.getBigDecimal(3))); values.close(); statement.close();
        return new Challan("PURCHASE".equals(row.getString(2)) ? Challan.Type.PURCHASE : Challan.Type.SALE, row.getString(1), row.getString(3), row.getString(4), row.getString(5), lines);
    }
    private void rollback(Connection connection) { try { connection.rollback(); connection.setAutoCommit(true); } catch (SQLException ignored) { } }
    private IllegalArgumentException failure(String message, SQLException error) { return new IllegalArgumentException(message + ": " + error.getMessage(), error); }
}
