package com.purchasesale.domain;

import java.math.BigDecimal;
import java.util.Arrays;

public final class ChallanTest {
    public static void main(String[] args) {
        postsMultipleLinesAndCalculatesTotal();
        rejectsAWholeSaleThatExceedsStock();
        rejectsDuplicateNumbers();
        System.out.println("ChallanTest: PASS");
    }

    private static void postsMultipleLinesAndCalculatesTotal() {
        InMemoryItemRepository items = new InMemoryItemRepository();
        items.save(new Item("A", "Item A", "EA", money("10"), money("8"), "REG"));
        items.save(new Item("B", "Item B", "EA", money("20"), money("15"), "REG"));
        InventoryService inventory = new InventoryService(items);
        Challan purchase = new Challan(Challan.Type.PURCHASE, "P-1", "2026-10-17", "Supplier", "Main", Arrays.asList(
                new Challan.Line("A", money("2"), money("8")),
                new Challan.Line("B", money("3"), money("15"))));
        check(inventory.post(purchase).compareTo(money("61")) == 0, "purchase total should be 61");
        check(inventory.stock("A", "Main").compareTo(money("2")) == 0, "item A stock should be 2");
        check(inventory.stock("B", "Main").compareTo(money("3")) == 0, "item B stock should be 3");
    }

    private static void rejectsAWholeSaleThatExceedsStock() {
        InMemoryItemRepository items = new InMemoryItemRepository();
        items.save(new Item("A", "Item A", "EA", money("10"), money("8"), "REG"));
        InventoryService inventory = new InventoryService(items);
        inventory.receive("A", "Main", money("10"), money("8"));
        Challan sale = new Challan(Challan.Type.SALE, "S-1", "2026-10-17", "Customer", "Main", Arrays.asList(
                new Challan.Line("A", money("6"), money("10")),
                new Challan.Line("A", money("6"), money("10"))));
        expectFailure(new Runnable() { @Override public void run() { inventory.post(sale); } });
        check(inventory.stock("A", "Main").compareTo(money("10")) == 0, "failed sale must not change stock");
    }

    private static void rejectsDuplicateNumbers() {
        InMemoryChallanRepository repository = new InMemoryChallanRepository();
        Challan challan = new Challan(Challan.Type.PURCHASE, "P-1", "2026-10-17", "Supplier", "Main",
                Arrays.asList(new Challan.Line("A", money("1"), money("1"))));
        repository.save(challan);
        expectFailure(new Runnable() { @Override public void run() { repository.save(challan); } });
    }

    private static BigDecimal money(String value) { return new BigDecimal(value); }

    private static void expectFailure(Runnable action) {
        try { action.run(); throw new AssertionError("expected failure"); }
        catch (IllegalArgumentException expected) { }
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
