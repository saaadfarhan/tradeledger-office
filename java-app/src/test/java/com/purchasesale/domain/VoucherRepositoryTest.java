package com.purchasesale.domain;

import java.math.BigDecimal;

public final class VoucherRepositoryTest {
    public static void main(String[] args) {
        InMemoryVoucherRepository repository = new InMemoryVoucherRepository();
        JournalVoucher journal = new JournalVoucher();
        journal.add("CASH", new BigDecimal("100"), BigDecimal.ZERO);
        journal.add("SALES", BigDecimal.ZERO, new BigDecimal("100"));
        repository.save(new PostedVoucher("V-1", "2026-10-17", "Test sale", "REF-1", journal));
        check(repository.findAll().size() == 1, "posted voucher should be retained");
        try {
            repository.save(new PostedVoucher("V-1", "2026-10-17", "Duplicate", "", journal));
            throw new AssertionError("duplicate voucher should fail");
        } catch (IllegalArgumentException expected) { }
        System.out.println("VoucherRepositoryTest: PASS");
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
