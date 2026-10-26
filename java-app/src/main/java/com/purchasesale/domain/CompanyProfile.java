package com.purchasesale.domain;

/** Office identity shown on the dashboard and future printed documents. */
public final class CompanyProfile {
    private final String name;
    private final String address;
    private final String phone;
    private final String fiscalYear;
    private final String logoPath;

    public CompanyProfile(String name, String address, String phone, String fiscalYear, String logoPath) {
        this.name = required(name, "Company name");
        this.address = text(address);
        this.phone = text(phone);
        this.fiscalYear = text(fiscalYear);
        this.logoPath = text(logoPath);
    }

    public String getName() { return name; }
    public String getAddress() { return address; }
    public String getPhone() { return phone; }
    public String getFiscalYear() { return fiscalYear; }
    public String getLogoPath() { return logoPath; }

    private static String required(String value, String label) {
        if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException(label + " is required");
        return value.trim();
    }

    private static String text(String value) { return value == null ? "" : value.trim(); }
}
