package com.purchasesale.domain;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** A purchase or sale document containing one or more stock lines. */
public final class Challan {
    public enum Type { PURCHASE, SALE }

    private final Type type;
    private final String number;
    private final String date;
    private final String party;
    private final String location;
    private final List<Line> lines;

    public Challan(Type type, String number, String date, String party, String location, List<Line> lines) {
        if (type == null) throw new IllegalArgumentException("Challan type is required");
        this.type = type;
        this.number = required(number, "Challan number");
        this.date = required(date, "Challan date");
        this.party = required(party, "Party");
        this.location = required(location, "Location");
        if (lines == null || lines.isEmpty()) throw new IllegalArgumentException("At least one challan line is required");
        this.lines = Collections.unmodifiableList(new ArrayList<Line>(lines));
    }

    public Type getType() { return type; }
    public String getNumber() { return number; }
    public String getDate() { return date; }
    public String getParty() { return party; }
    public String getLocation() { return location; }
    public List<Line> getLines() { return lines; }

    public BigDecimal total() {
        BigDecimal total = BigDecimal.ZERO;
        for (Line line : lines) total = total.add(line.amount());
        return total;
    }

    private static String required(String value, String label) {
        if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException(label + " is required");
        return value.trim();
    }

    public static final class Line {
        private final String itemCode;
        private final BigDecimal quantity;
        private final BigDecimal rate;

        public Line(String itemCode, BigDecimal quantity, BigDecimal rate) {
            if (itemCode == null || itemCode.trim().isEmpty()) throw new IllegalArgumentException("Item code is required");
            if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("Quantity must be positive");
            if (rate == null || rate.compareTo(BigDecimal.ZERO) < 0) throw new IllegalArgumentException("Rate cannot be negative");
            this.itemCode = itemCode.trim();
            this.quantity = quantity;
            this.rate = rate;
        }

        public String getItemCode() { return itemCode; }
        public BigDecimal getQuantity() { return quantity; }
        public BigDecimal getRate() { return rate; }
        public BigDecimal amount() { return quantity.multiply(rate); }
    }
}
