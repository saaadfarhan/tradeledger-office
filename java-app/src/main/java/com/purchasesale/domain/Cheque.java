package com.purchasesale.domain;

import java.math.BigDecimal;

public final class Cheque {
    private final String number;
    private final String bankCode;
    private final String date;
    private final String party;
    private final BigDecimal amount;
    private final String status;
    private final String manualId;

    public Cheque(String number, String bankCode, String date, String party, BigDecimal amount, String status) {
        this(number, bankCode, date, party, amount, status, "");
    }

    public Cheque(String number, String bankCode, String date, String party, BigDecimal amount, String status, String manualId) {
        this.number = required(number, "Cheque number");
        this.bankCode = required(bankCode, "Bank code");
        this.date = required(date, "Cheque date");
        this.party = required(party, "Party");
        if (amount == null || amount.compareTo(BigDecimal.ZERO) < 0) throw new IllegalArgumentException("Cheque amount cannot be negative");
        this.amount = amount;
        this.status = required(status, "Cheque status");
        this.manualId = manualId == null ? "" : manualId.trim();
    }
    public String getNumber() { return number; }
    public String getBankCode() { return bankCode; }
    public String getDate() { return date; }
    public String getParty() { return party; }
    public BigDecimal getAmount() { return amount; }
    public String getStatus() { return status; }
    public String getManualId() { return manualId; }
    private static String required(String value, String label) { if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException(label + " is required"); return value.trim(); }
}
