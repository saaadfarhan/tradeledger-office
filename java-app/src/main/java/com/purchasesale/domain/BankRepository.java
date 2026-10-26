package com.purchasesale.domain;

import java.util.List;

public interface BankRepository {
    List<Bank> findAll();
    void save(Bank bank);
    void update(Bank bank);
    void deleteByCode(String code);
}
