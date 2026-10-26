package com.purchasesale.sqlite;

import com.purchasesale.domain.Bank;
import com.purchasesale.domain.BankRepository;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public final class SQLiteBankRepository implements BankRepository {
    private final SQLiteDatabase database;
    public SQLiteBankRepository(SQLiteDatabase database) { this.database = database; }
    @Override public List<Bank> findAll() {
        List<Bank> result = new ArrayList<Bank>();
        try { ResultSet rows = database.connection().createStatement().executeQuery("SELECT code, name, account_number, opening_balance, address, phone FROM banks ORDER BY code"); while (rows.next()) result.add(read(rows)); rows.close(); return result; }
        catch (SQLException error) { throw failure("Cannot load banks", error); }
    }
    @Override public void save(Bank bank) { execute(bank, "INSERT INTO banks(code, name, account_number, opening_balance, address, phone) VALUES (?, ?, ?, ?, ?, ?)", false); }
    @Override public void update(Bank bank) { execute(bank, "UPDATE banks SET name = ?, account_number = ?, opening_balance = ?, address = ?, phone = ? WHERE code = ?", true); }
    @Override public void deleteByCode(String code) {
        try { PreparedStatement statement = database.connection().prepareStatement("DELETE FROM banks WHERE code = ?"); statement.setString(1, code); if (statement.executeUpdate() == 0) throw new IllegalArgumentException("Bank code does not exist: " + code); statement.close(); }
        catch (SQLException error) { throw failure("Cannot delete bank", error); }
    }
    private void execute(Bank bank, String sql, boolean update) {
        try { PreparedStatement statement = database.connection().prepareStatement(sql); if (update) { statement.setString(1, bank.getName()); statement.setString(2, bank.getAccountNumber()); statement.setBigDecimal(3, bank.getOpeningBalance()); statement.setString(4, bank.getAddress()); statement.setString(5, bank.getPhone()); statement.setString(6, bank.getCode()); } else { statement.setString(1, bank.getCode()); statement.setString(2, bank.getName()); statement.setString(3, bank.getAccountNumber()); statement.setBigDecimal(4, bank.getOpeningBalance()); statement.setString(5, bank.getAddress()); statement.setString(6, bank.getPhone()); } if (statement.executeUpdate() == 0 && update) throw new IllegalArgumentException("Bank code does not exist: " + bank.getCode()); statement.close(); }
        catch (SQLException error) { throw failure("Cannot save bank", error); }
    }
    private Bank read(ResultSet rows) throws SQLException { return new Bank(rows.getString(1), rows.getString(2), rows.getString(3), rows.getBigDecimal(4), rows.getString(5), rows.getString(6)); }
    private IllegalArgumentException failure(String message, SQLException error) { return new IllegalArgumentException(message + ": " + error.getMessage(), error); }
}
