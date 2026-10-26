package com.purchasesale.sqlite;

import com.purchasesale.domain.Account;
import com.purchasesale.domain.AccountRepository;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public final class SQLiteAccountRepository implements AccountRepository {
    private final SQLiteDatabase database;
    public SQLiteAccountRepository(SQLiteDatabase database) { this.database = database; }

    @Override public List<Account> findAll() {
        List<Account> result = new ArrayList<Account>();
        try {
            ResultSet rows = database.connection().createStatement().executeQuery("SELECT code, description, parent_code FROM accounts ORDER BY code");
            while (rows.next()) result.add(new Account(rows.getString(1), rows.getString(2), rows.getString(3)));
            rows.close();
            return result;
        } catch (SQLException error) { throw failure("Cannot load accounts", error); }
    }

    @Override public void save(Account account) {
        try {
            PreparedStatement statement = database.connection().prepareStatement("INSERT INTO accounts(code, description, parent_code) VALUES (?, ?, ?)");
            statement.setString(1, account.getCode()); statement.setString(2, account.getDescription()); statement.setString(3, account.getParentCode());
            statement.executeUpdate(); statement.close();
        } catch (SQLException error) { throw failure("Cannot save account", error); }
    }

    @Override public void update(Account account) {
        try {
            PreparedStatement statement = database.connection().prepareStatement("UPDATE accounts SET description = ?, parent_code = ? WHERE code = ?");
            statement.setString(1, account.getDescription()); statement.setString(2, account.getParentCode()); statement.setString(3, account.getCode());
            if (statement.executeUpdate() == 0) throw new IllegalArgumentException("Account code does not exist: " + account.getCode());
            statement.close();
        } catch (SQLException error) { throw failure("Cannot update account", error); }
    }

    @Override public void deleteByCode(String code) {
        try {
            PreparedStatement child = database.connection().prepareStatement("SELECT 1 FROM accounts WHERE parent_code = ? LIMIT 1");
            child.setString(1, code);
            if (child.executeQuery().next()) throw new IllegalArgumentException("Delete child accounts first");
            child.close();
            PreparedStatement statement = database.connection().prepareStatement("DELETE FROM accounts WHERE code = ?");
            statement.setString(1, code);
            if (statement.executeUpdate() == 0) throw new IllegalArgumentException("Account code does not exist: " + code);
            statement.close();
        } catch (SQLException error) { throw failure("Cannot delete account", error); }
    }

    private IllegalArgumentException failure(String message, SQLException error) { return new IllegalArgumentException(message + ": " + error.getMessage(), error); }
}
