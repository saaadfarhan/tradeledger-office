package com.purchasesale.domain;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class InMemoryBankRepository implements BankRepository {
    private final List<Bank> banks = new ArrayList<Bank>();

    @Override public List<Bank> findAll() {
        return Collections.unmodifiableList(new ArrayList<Bank>(banks));
    }

    @Override public void save(Bank bank) {
        for (Bank existing : banks) {
            if (existing.getCode().equals(bank.getCode())) {
                throw new IllegalArgumentException("Bank code already exists: " + bank.getCode());
            }
        }
        banks.add(bank);
    }

    @Override public void update(Bank bank) {
        if (bank == null) throw new IllegalArgumentException("Bank is required");
        for (int i = 0; i < banks.size(); i++) if (banks.get(i).getCode().equals(bank.getCode())) {
            banks.set(i, bank);
            return;
        }
        throw new IllegalArgumentException("Bank code does not exist: " + bank.getCode());
    }

    @Override public void deleteByCode(String code) {
        for (int i = 0; i < banks.size(); i++) {
            if (banks.get(i).getCode().equals(code)) {
                banks.remove(i);
                return;
            }
        }
        throw new IllegalArgumentException("Bank code does not exist: " + code);
    }
}
