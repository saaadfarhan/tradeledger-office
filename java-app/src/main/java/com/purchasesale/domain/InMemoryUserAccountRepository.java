package com.purchasesale.domain;

import java.util.ArrayList;
import java.util.List;

public final class InMemoryUserAccountRepository implements UserAccountRepository {
    private final List<UserAccount> users = new ArrayList<UserAccount>();
    @Override public List<UserAccount> findAll() { return new ArrayList<UserAccount>(users); }
    @Override public void save(UserAccount user) {
        for (int i = 0; i < users.size(); i++) if (users.get(i).getUsername().equalsIgnoreCase(user.getUsername())) { users.set(i, user); return; }
        users.add(user);
    }
    @Override public void delete(String username) {
        for (int i = 0; i < users.size(); i++) if (users.get(i).getUsername().equalsIgnoreCase(username)) { users.remove(i); return; }
    }
}
