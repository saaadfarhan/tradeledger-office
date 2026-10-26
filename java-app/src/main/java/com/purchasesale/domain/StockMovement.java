package com.purchasesale.domain;

import java.math.BigDecimal;

/** Immutable inventory movement used by the session reports. */
public final class StockMovement {
    private final String date;
    private final String document;
    private final String type;
    private final String itemCode;
    private final String location;
    private final BigDecimal quantity;
    private final BigDecimal rate;

    public StockMovement(String date, String document, String type, String itemCode, String location, BigDecimal quantity, BigDecimal rate) {
        this.date = required(date, "Date");
        this.document = required(document, "Document");
        this.type = required(type, "Movement type");
        this.itemCode = required(itemCode, "Item code");
        this.location = required(location, "Location");
        this.quantity = quantity;
        this.rate = rate;
    }

    public String getDate() { return date; }
    public String getDocument() { return document; }
    public String getType() { return type; }
    public String getItemCode() { return itemCode; }
    public String getLocation() { return location; }
    public BigDecimal getQuantity() { return quantity; }
    public BigDecimal getRate() { return rate; }
    public BigDecimal getAmount() { return quantity.abs().multiply(rate); }

    private static String required(String value, String label) {
        if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException(label + " is required");
        return value.trim();
    }
}
