package com.purchasesale.sqlite;

import com.purchasesale.domain.Item;
import com.purchasesale.domain.ItemRepository;
import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public final class SQLiteItemRepository implements ItemRepository {
    private final SQLiteDatabase database;
    public SQLiteItemRepository(SQLiteDatabase database) { this.database = database; }
    @Override public List<Item> findAll() {
        List<Item> result = new ArrayList<Item>();
        try {
            ResultSet rows = database.connection().createStatement().executeQuery("SELECT code, description, unit, sale_rate, purchase_rate, stock_type FROM items ORDER BY code");
            while (rows.next()) result.add(read(rows));
            rows.close(); return result;
        } catch (SQLException error) { throw failure("Cannot load items", error); }
    }
    @Override public Item findByCode(String code) {
        try {
            PreparedStatement statement = database.connection().prepareStatement("SELECT code, description, unit, sale_rate, purchase_rate, stock_type FROM items WHERE code = ?");
            statement.setString(1, code); ResultSet rows = statement.executeQuery();
            Item result = rows.next() ? read(rows) : null; rows.close(); statement.close(); return result;
        } catch (SQLException error) { throw failure("Cannot find item", error); }
    }
    @Override public void save(Item item) { execute(item, "INSERT INTO items(code, description, unit, sale_rate, purchase_rate, stock_type) VALUES (?, ?, ?, ?, ?, ?)", false); }
    @Override public void update(Item item) { execute(item, "UPDATE items SET description = ?, unit = ?, sale_rate = ?, purchase_rate = ?, stock_type = ? WHERE code = ?", true); }
    @Override public void deleteByCode(String code) {
        try { PreparedStatement statement = database.connection().prepareStatement("DELETE FROM items WHERE code = ?"); statement.setString(1, code); if (statement.executeUpdate() == 0) throw new IllegalArgumentException("Item code does not exist: " + code); statement.close(); }
        catch (SQLException error) { throw failure("Cannot delete item", error); }
    }
    private void execute(Item item, String sql, boolean update) {
        try {
            PreparedStatement statement = database.connection().prepareStatement(sql);
            if (update) { statement.setString(1, item.getDescription()); statement.setString(2, item.getUnit()); statement.setBigDecimal(3, item.getSaleRate()); statement.setBigDecimal(4, item.getPurchaseRate()); statement.setString(5, item.getStockType()); statement.setString(6, item.getCode()); }
            else { statement.setString(1, item.getCode()); statement.setString(2, item.getDescription()); statement.setString(3, item.getUnit()); statement.setBigDecimal(4, item.getSaleRate()); statement.setBigDecimal(5, item.getPurchaseRate()); statement.setString(6, item.getStockType()); }
            if (statement.executeUpdate() == 0 && update) throw new IllegalArgumentException("Item code does not exist: " + item.getCode());
            statement.close();
        } catch (SQLException error) { throw failure("Cannot save item", error); }
    }
    private Item read(ResultSet rows) throws SQLException { return new Item(rows.getString(1), rows.getString(2), rows.getString(3), rows.getBigDecimal(4), rows.getBigDecimal(5), rows.getString(6)); }
    private IllegalArgumentException failure(String message, SQLException error) { return new IllegalArgumentException(message + ": " + error.getMessage(), error); }
}
