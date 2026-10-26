package com.purchasesale.domain;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class InMemoryChallanRepository implements ChallanRepository {
    private final List<Challan> challans = new ArrayList<Challan>();

    @Override public void save(Challan challan) {
        if (challan == null) throw new IllegalArgumentException("Challan is required");
        if (containsNumber(challan.getNumber())) throw new IllegalArgumentException("Challan number already exists: " + challan.getNumber());
        challans.add(challan);
    }

    @Override public boolean containsNumber(String number) {
        if (number == null) return false;
        for (Challan challan : challans) if (challan.getNumber().equals(number.trim())) return true;
        return false;
    }

    @Override public List<Challan> findAll() {
        return Collections.unmodifiableList(new ArrayList<Challan>(challans));
    }
}
