package com.purchasesale.domain;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class InMemoryAccountRepository implements AccountRepository {
    private final List<Account> accounts = new ArrayList<Account>();

    @Override public List<Account> findAll() {
        return Collections.unmodifiableList(new ArrayList<Account>(accounts));
    }

    @Override public void save(Account account) {
        for (Account existing : accounts) {
            if (existing.getCode().equals(account.getCode())) {
                throw new IllegalArgumentException("Account code already exists: " + account.getCode());
            }
        }
        if (account.getParentCode() != null && find(account.getParentCode()) == null) {
            throw new IllegalArgumentException("Parent account does not exist: " + account.getParentCode());
        }
        accounts.add(account);
    }

    @Override public void update(Account account) {
        if (account == null) throw new IllegalArgumentException("Account is required");
        if (account.getParentCode() != null && find(account.getParentCode()) == null) throw new IllegalArgumentException("Parent account does not exist: " + account.getParentCode());
        if (account.getCode().equals(account.getParentCode())) throw new IllegalArgumentException("An account cannot be its own parent");
        for (int i = 0; i < accounts.size(); i++) {
            if (accounts.get(i).getCode().equals(account.getCode())) {
                accounts.set(i, account);
                return;
            }
        }
        throw new IllegalArgumentException("Account code does not exist: " + account.getCode());
    }

    @Override public void deleteByCode(String code) {
        for (Account account : accounts) if (account.getCode().equals(code)) {
            for (Account child : accounts) if (code.equals(child.getParentCode())) throw new IllegalArgumentException("Delete child accounts first");
            accounts.remove(account);
            return;
        }
        throw new IllegalArgumentException("Account code does not exist: " + code);
    }

    private Account find(String code) {
        for (Account account : accounts) if (account.getCode().equals(code)) return account;
        return null;
    }
}
