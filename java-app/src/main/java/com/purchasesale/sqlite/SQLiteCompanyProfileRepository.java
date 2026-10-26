package com.purchasesale.sqlite;

import com.purchasesale.domain.CompanyProfile;
import com.purchasesale.domain.CompanyProfileRepository;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public final class SQLiteCompanyProfileRepository implements CompanyProfileRepository {
    private final SQLiteDatabase database;
    public SQLiteCompanyProfileRepository(SQLiteDatabase database) { this.database = database; }

    @Override public CompanyProfile load() {
        try {
            ResultSet rows = database.connection().createStatement().executeQuery("SELECT name, address, phone, fiscal_year, logo_path FROM company_profile WHERE id = 1");
            CompanyProfile profile = rows.next() ? new CompanyProfile(rows.getString(1), rows.getString(2), rows.getString(3), rows.getString(4), rows.getString(5)) : new CompanyProfile("Purchase Sale Office", "", "", "", "");
            rows.close();
            return profile;
        } catch (SQLException error) { throw failure("Cannot load company profile", error); }
    }

    @Override public void save(CompanyProfile profile) {
        try {
            PreparedStatement statement = database.connection().prepareStatement("INSERT OR REPLACE INTO company_profile(id, name, address, phone, fiscal_year, logo_path) VALUES (1, ?, ?, ?, ?, ?)");
            statement.setString(1, profile.getName());
            statement.setString(2, profile.getAddress());
            statement.setString(3, profile.getPhone());
            statement.setString(4, profile.getFiscalYear());
            statement.setString(5, profile.getLogoPath());
            statement.executeUpdate();
            statement.close();
        } catch (SQLException error) { throw failure("Cannot save company profile", error); }
    }

    private IllegalArgumentException failure(String message, SQLException error) { return new IllegalArgumentException(message + ": " + error.getMessage(), error); }
}
