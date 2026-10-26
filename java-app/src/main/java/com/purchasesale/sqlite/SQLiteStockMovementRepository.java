package com.purchasesale.sqlite;

import com.purchasesale.domain.StockMovement;
import com.purchasesale.domain.StockMovementRepository;
import java.sql.PreparedStatement;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public final class SQLiteStockMovementRepository implements StockMovementRepository {
    private final SQLiteDatabase database;
    public SQLiteStockMovementRepository(SQLiteDatabase database) { this.database = database; }
    @Override public void save(StockMovement movement) {
        try {
            PreparedStatement statement = database.connection().prepareStatement("INSERT INTO stock_movements(date, document, type, item_code, location, quantity, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            statement.setString(1, movement.getDate()); statement.setString(2, movement.getDocument()); statement.setString(3, movement.getType()); statement.setString(4, movement.getItemCode()); statement.setString(5, movement.getLocation()); statement.setBigDecimal(6, movement.getQuantity()); statement.setBigDecimal(7, movement.getRate()); statement.setBigDecimal(8, movement.getAmount()); statement.executeUpdate(); statement.close();
        } catch (SQLException error) { throw failure("Cannot save stock movement", error); }
    }
    @Override public void saveAll(List<StockMovement> movements) {
        Connection connection = database.connection();
        try {
            connection.setAutoCommit(false);
            PreparedStatement statement = connection.prepareStatement("INSERT INTO stock_movements(date, document, type, item_code, location, quantity, rate, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            for (StockMovement movement : movements) {
                statement.setString(1, movement.getDate()); statement.setString(2, movement.getDocument());
                statement.setString(3, movement.getType()); statement.setString(4, movement.getItemCode());
                statement.setString(5, movement.getLocation()); statement.setBigDecimal(6, movement.getQuantity());
                statement.setBigDecimal(7, movement.getRate()); statement.setBigDecimal(8, movement.getAmount());
                statement.addBatch();
            }
            statement.executeBatch(); statement.close(); connection.commit(); connection.setAutoCommit(true);
        } catch (SQLException error) {
            try { connection.rollback(); connection.setAutoCommit(true); } catch (SQLException ignored) { }
            throw failure("Cannot save stock movements", error);
        }
    }
    @Override public List<StockMovement> findAll() {
        List<StockMovement> result = new ArrayList<StockMovement>();
        try { ResultSet rows = database.connection().createStatement().executeQuery("SELECT date, document, type, item_code, location, quantity, rate FROM stock_movements ORDER BY id"); while (rows.next()) result.add(new StockMovement(rows.getString(1), rows.getString(2), rows.getString(3), rows.getString(4), rows.getString(5), rows.getBigDecimal(6), rows.getBigDecimal(7))); rows.close(); return result; }
        catch (SQLException error) { throw failure("Cannot load stock movements", error); }
    }
    private IllegalArgumentException failure(String message, SQLException error) { return new IllegalArgumentException(message + ": " + error.getMessage(), error); }
}
