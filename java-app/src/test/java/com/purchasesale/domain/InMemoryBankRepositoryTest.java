package com.purchasesale.domain;

import java.math.BigDecimal;

public final class InMemoryBankRepositoryTest {
    public static void main(String[] args) {
        savesBanksAndRejectsInvalidRecords();
        System.out.println("InMemoryBankRepositoryTest: PASS");
    }

    private static void savesBanksAndRejectsInvalidRecords() {
        InMemoryBankRepository repository = new InMemoryBankRepository();
        repository.save(new Bank("BANK-001", "Test Bank", "123", new BigDecimal("1000"), "Office", "0300"));
        check(repository.findAll().size() == 1, "one bank expected");
        repository.deleteByCode("BANK-001");
        check(repository.findAll().isEmpty(), "bank should be deleted");
        repository.save(new Bank("BANK-001", "Test Bank", "123", new BigDecimal("1000"), "Office", "0300"));
        expectFailure(new Runnable() {
            @Override public void run() {
                repository.save(new Bank("BANK-001", "Duplicate", "", BigDecimal.ZERO, "", ""));
            }
        });
        expectFailure(new Runnable() {
            @Override public void run() {
                new Bank("", "Missing code", "", BigDecimal.ZERO, "", "");
            }
        });
        expectFailure(new Runnable() {
            @Override public void run() {
                new Bank("BANK-002", "Negative", "", new BigDecimal("-1"), "", "");
            }
        });
    }

    private static void expectFailure(Runnable action) {
        try { action.run(); throw new AssertionError("expected failure"); }
        catch (IllegalArgumentException expected) { }
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
