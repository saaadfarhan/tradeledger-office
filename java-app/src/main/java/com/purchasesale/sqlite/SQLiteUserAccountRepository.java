package com.purchasesale.sqlite;

import com.purchasesale.domain.UserAccount;
import com.purchasesale.domain.UserAccountRepository;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;

public final class SQLiteUserAccountRepository implements UserAccountRepository {
    private final SQLiteDatabase database;
    public SQLiteUserAccountRepository(SQLiteDatabase database) { this.database = database; }
    @Override public List<UserAccount> findAll() {
        List<UserAccount> result = new ArrayList<UserAccount>();
        try {
            ResultSet rows = database.connection().createStatement().executeQuery("SELECT username, password_hash, permissions FROM users ORDER BY username");
            while (rows.next()) result.add(new UserAccount(rows.getString(1), rows.getString(2), split(rows.getString(3))));
            rows.close();
            return result;
        } catch (SQLException error) { throw failure("Cannot load users", error); }
    }
    @Override public void save(UserAccount user) {
        try {
            PreparedStatement statement = database.connection().prepareStatement("INSERT OR REPLACE INTO users(username, password_hash, permissions) VALUES (?, ?, ?)");
            statement.setString(1, user.getUsername()); statement.setString(2, user.getPasswordHash()); statement.setString(3, join(user));
            statement.executeUpdate(); statement.close();
        } catch (SQLException error) { throw failure("Cannot save user", error); }
    }
    @Override public void delete(String username) {
        try {
            PreparedStatement statement = database.connection().prepareStatement("DELETE FROM users WHERE username = ?");
            statement.setString(1, username);
            statement.executeUpdate(); statement.close();
        } catch (SQLException error) { throw failure("Cannot delete user", error); }
    }
    private String join(UserAccount user) { return join(user.getPermissions()); }
    private String join(java.util.Set<String> values) { return String.join("\u001f", values); }
    private java.util.Set<String> split(String value) { return value == null || value.isEmpty() ? new LinkedHashSet<String>() : new LinkedHashSet<String>(Arrays.asList(value.split("\u001f", -1))); }
    private IllegalArgumentException failure(String message, SQLException error) { return new IllegalArgumentException(message + ": " + error.getMessage(), error); }
}
