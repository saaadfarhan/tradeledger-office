package com.purchasesale.domain;

import java.math.BigDecimal;

public final class Item {
    private final String code;
    private final String description;
    private final String unit;
    private final BigDecimal saleRate;
    private final BigDecimal purchaseRate;
    private final String stockType;

    public Item(String code, String description, String unit, BigDecimal saleRate, BigDecimal purchaseRate, String stockType) {
        this.code = required(code, "Item code");
        this.description = required(description, "Description");
        this.unit = required(unit, "Unit");
        this.saleRate = nonNegative(saleRate, "Sale rate");
        this.purchaseRate = nonNegative(purchaseRate, "Purchase rate");
        this.stockType = required(stockType, "Stock type");
    }

    public String getCode() { return code; }
    public String getDescription() { return description; }
    public String getUnit() { return unit; }
    public BigDecimal getSaleRate() { return saleRate; }
    public BigDecimal getPurchaseRate() { return purchaseRate; }
    public String getStockType() { return stockType; }

    private static String required(String value, String label) {
        if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException(label + " is required");
        return value.trim();
    }

    private static BigDecimal nonNegative(BigDecimal value, String label) {
        if (value == null || value.compareTo(BigDecimal.ZERO) < 0) throw new IllegalArgumentException(label + " cannot be negative");
        return value;
    }
}
