package com.purchasesale.domain;

import java.math.BigDecimal;

public final class Bank {
    private final String code;
    private final String name;
    private final String accountNumber;
    private final BigDecimal openingBalance;
    private final String address;
    private final String phone;

    public Bank(String code, String name, String accountNumber, BigDecimal openingBalance, String address, String phone) {
        this.code = required(code, "Bank code");
        this.name = required(name, "Bank name");
        this.accountNumber = accountNumber == null ? "" : accountNumber.trim();
        if (openingBalance == null || openingBalance.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Opening balance cannot be negative");
        }
        this.openingBalance = openingBalance;
        this.address = address == null ? "" : address.trim();
        this.phone = phone == null ? "" : phone.trim();
    }

    public String getCode() { return code; }
    public String getName() { return name; }
    public String getAccountNumber() { return accountNumber; }
    public BigDecimal getOpeningBalance() { return openingBalance; }
    public String getAddress() { return address; }
    public String getPhone() { return phone; }

    private static String required(String value, String label) {
        if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException(label + " is required");
        return value.trim();
    }
}
