package com.purchasesale.domain;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class JournalVoucher {
    private final List<JournalLine> lines = new ArrayList<JournalLine>();

    public void add(String accountCode, BigDecimal debit, BigDecimal credit) {
        if (accountCode == null || accountCode.trim().isEmpty()) throw new IllegalArgumentException("Account is required");
        if (debit == null || credit == null || debit.compareTo(BigDecimal.ZERO) < 0 || credit.compareTo(BigDecimal.ZERO) < 0) throw new IllegalArgumentException("Amounts cannot be negative");
        if (debit.signum() > 0 && credit.signum() > 0) throw new IllegalArgumentException("A line cannot contain both debit and credit");
        if (debit.signum() == 0 && credit.signum() == 0) throw new IllegalArgumentException("A line must have a debit or credit amount");
        lines.add(new JournalLine(accountCode, debit, credit));
    }

    public List<JournalLine> lines() { return Collections.unmodifiableList(lines); }

    public void validateBalanced() {
        if (lines.isEmpty()) throw new IllegalArgumentException("Voucher needs at least one line");
        BigDecimal debit = BigDecimal.ZERO;
        BigDecimal credit = BigDecimal.ZERO;
        for (JournalLine line : lines) { debit = debit.add(line.debit); credit = credit.add(line.credit); }
        if (debit.compareTo(credit) != 0) throw new IllegalArgumentException("Debit and credit totals must balance");
    }

    public static final class JournalLine {
        private final String accountCode;
        private final BigDecimal debit;
        private final BigDecimal credit;
        private JournalLine(String accountCode, BigDecimal debit, BigDecimal credit) { this.accountCode = accountCode; this.debit = debit; this.credit = credit; }
        public String getAccountCode() { return accountCode; }
        public BigDecimal getDebit() { return debit; }
        public BigDecimal getCredit() { return credit; }
    }
}
