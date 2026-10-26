package com.purchasesale.domain;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** A validated voucher document retained for the current session. */
public final class PostedVoucher {
    private final String number;
    private final String date;
    private final String narration;
    private final String reference;
    private final JournalVoucher journal;

    public PostedVoucher(String number, String date, String narration, String reference, JournalVoucher journal) {
        this.number = required(number, "Voucher number");
        this.date = required(date, "Voucher date");
        this.narration = narration == null ? "" : narration.trim();
        this.reference = reference == null ? "" : reference.trim();
        if (journal == null) throw new IllegalArgumentException("Voucher lines are required");
        journal.validateBalanced();
        this.journal = journal;
    }

    public String getNumber() { return number; }
    public String getDate() { return date; }
    public String getNarration() { return narration; }
    public String getReference() { return reference; }
    public List<JournalVoucher.JournalLine> lines() { return Collections.unmodifiableList(new ArrayList<JournalVoucher.JournalLine>(journal.lines())); }

    private static String required(String value, String label) {
        if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException(label + " is required");
        return value.trim();
    }
}
