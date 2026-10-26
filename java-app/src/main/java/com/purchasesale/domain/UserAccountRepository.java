package com.purchasesale.domain;

import java.util.List;

public interface UserAccountRepository {
    List<UserAccount> findAll();
    void save(UserAccount user);
    void delete(String username);
}
