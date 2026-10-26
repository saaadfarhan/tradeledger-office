package com.purchasesale.domain;

public final class InMemoryAccountRepositoryTest {
    public static void main(String[] args) {
        savesAccountsAndRejectsInvalidHierarchy();
        System.out.println("InMemoryAccountRepositoryTest: PASS");
    }

    private static void savesAccountsAndRejectsInvalidHierarchy() {
        InMemoryAccountRepository repository = new InMemoryAccountRepository();
        repository.save(new Account("1", "Assets", null));
        repository.save(new Account("11", "Cash", "1"));
        check(repository.findAll().size() == 2, "two accounts expected");
        expectFailure(new Runnable() {
            @Override public void run() { repository.save(new Account("11", "Duplicate", "1")); }
        });
        expectFailure(new Runnable() {
            @Override public void run() { repository.save(new Account("12", "Missing parent", "999")); }
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
