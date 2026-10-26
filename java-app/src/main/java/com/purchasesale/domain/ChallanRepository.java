package com.purchasesale.domain;

import java.util.List;

public interface ChallanRepository {
    void save(Challan challan);
    boolean containsNumber(String number);
    List<Challan> findAll();
}
