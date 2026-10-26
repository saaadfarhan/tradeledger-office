package com.purchasesale.domain;

import java.util.List;

public interface VoucherRepository {
    void save(PostedVoucher voucher);
    List<PostedVoucher> findAll();
}
