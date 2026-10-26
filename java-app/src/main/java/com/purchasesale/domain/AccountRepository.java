package com.purchasesale.domain;

import java.util.List;

public interface AccountRepository {
    List<Account> findAll();
    void save(Account account);
    void update(Account account);
    void deleteByCode(String code);
}
