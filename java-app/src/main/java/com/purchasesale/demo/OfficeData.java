package com.purchasesale.demo;

import com.purchasesale.domain.Account;
import com.purchasesale.domain.AccountRepository;
import com.purchasesale.domain.BankRepository;
import com.purchasesale.domain.ChallanRepository;
import com.purchasesale.domain.InMemoryAccountRepository;
import com.purchasesale.domain.InMemoryBankRepository;
import com.purchasesale.domain.InMemoryChallanRepository;
import com.purchasesale.domain.ItemRepository;
import com.purchasesale.domain.InMemoryItemRepository;
import com.purchasesale.domain.VoucherRepository;
import com.purchasesale.domain.InMemoryVoucherRepository;
import com.purchasesale.domain.StockMovementRepository;
import com.purchasesale.domain.InMemoryStockMovementRepository;

public final class OfficeData {
    private OfficeData() { }

    public static AccountRepository accounts() {
        // Deliberately empty. Real records must be created by the user or loaded from SQLite.
        return new InMemoryAccountRepository();
    }

    public static BankRepository banks() {
        // Deliberately empty. Banks are created through the Bank screen or loaded from SQLite.
        return new InMemoryBankRepository();
    }

    public static ItemRepository items() {
        return new InMemoryItemRepository();
    }

    public static ChallanRepository challans() {
        return new InMemoryChallanRepository();
    }

    public static VoucherRepository vouchers() {
        return new InMemoryVoucherRepository();
    }

    public static StockMovementRepository stockMovements() {
        return new InMemoryStockMovementRepository();
    }
}
