package com.purchasesale.domain;

public final class Account {
    private final String code;
    private final String description;
    private final String parentCode;

    public Account(String code, String description, String parentCode) {
        if (code == null || code.trim().isEmpty()) throw new IllegalArgumentException("Account code is required");
        if (description == null || description.trim().isEmpty()) throw new IllegalArgumentException("Description is required");
        this.code = code.trim();
        this.description = description.trim();
        this.parentCode = parentCode;
    }

    public String getCode() { return code; }
    public String getDescription() { return description; }
    public String getParentCode() { return parentCode; }

    @Override public String toString() { return description + " (" + code + ")"; }
}
