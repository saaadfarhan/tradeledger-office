package com.purchasesale.domain;

import java.math.BigDecimal;

public final class InventoryAndVoucherTest {
    public static void main(String[] args) {
        purchaseSaleAndTransferRespectStock();
        vouchersMustBalance();
        System.out.println("InventoryAndVoucherTest: PASS");
    }

    private static void purchaseSaleAndTransferRespectStock() {
        InMemoryItemRepository items = new InMemoryItemRepository();
        items.save(new Item("WIRE-001", "Copper Wire", "MTR", new BigDecimal("125"), new BigDecimal("100"), "Regular"));
        InventoryService inventory = new InventoryService(items);
        check(inventory.receive("WIRE-001", "Main", new BigDecimal("10"), new BigDecimal("100")).compareTo(new BigDecimal("1000")) == 0, "purchase total expected");
        inventory.sell("WIRE-001", "Main", new BigDecimal("3"), new BigDecimal("125"));
        inventory.transfer("WIRE-001", "Main", "Branch", new BigDecimal("2"));
        check(inventory.stock("WIRE-001", "Main").compareTo(new BigDecimal("5")) == 0, "main stock expected");
        check(inventory.stock("WIRE-001", "Branch").compareTo(new BigDecimal("2")) == 0, "branch stock expected");
        expectFailure(new Runnable() { @Override public void run() { inventory.sell("WIRE-001", "Main", new BigDecimal("6"), new BigDecimal("125")); } });
    }

    private static void vouchersMustBalance() {
        JournalVoucher voucher = new JournalVoucher();
        voucher.add("CASH", new BigDecimal("100"), BigDecimal.ZERO);
        expectFailure(new Runnable() { @Override public void run() { voucher.validateBalanced(); } });
        voucher.add("SALES", BigDecimal.ZERO, new BigDecimal("100"));
        voucher.validateBalanced();
    }

    private static void expectFailure(Runnable action) {
        try { action.run(); throw new AssertionError("expected failure"); }
        catch (IllegalArgumentException expected) { }
    }

    private static void check(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
}
