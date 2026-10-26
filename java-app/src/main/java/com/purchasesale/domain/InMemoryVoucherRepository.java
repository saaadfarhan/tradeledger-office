package com.purchasesale.domain;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class InMemoryVoucherRepository implements VoucherRepository {
    private final List<PostedVoucher> vouchers = new ArrayList<PostedVoucher>();

    @Override public void save(PostedVoucher voucher) {
        if (voucher == null) throw new IllegalArgumentException("Voucher is required");
        for (PostedVoucher existing : vouchers) {
            if (existing.getNumber().equals(voucher.getNumber())) throw new IllegalArgumentException("Voucher number already exists: " + voucher.getNumber());
        }
        vouchers.add(voucher);
    }

    @Override public List<PostedVoucher> findAll() {
        return Collections.unmodifiableList(new ArrayList<PostedVoucher>(vouchers));
    }
}
