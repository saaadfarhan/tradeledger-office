package com.purchasesale.domain;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

public final class UserAccount {
    private final String username;
    private final String passwordHash;
    private final Set<String> permissions;

    public UserAccount(String username, String passwordHash, Set<String> permissions) {
        if (username == null || username.trim().isEmpty()) throw new IllegalArgumentException("User name is required");
        if (passwordHash == null || passwordHash.trim().isEmpty()) throw new IllegalArgumentException("Password hash is required");
        this.username = username.trim();
        this.passwordHash = passwordHash.trim();
        this.permissions = Collections.unmodifiableSet(new LinkedHashSet<String>(permissions));
    }
    public String getUsername() { return username; }
    public String getPasswordHash() { return passwordHash; }
    public Set<String> getPermissions() { return permissions; }
}
