package com.purchasesale.domain;

import java.util.List;

public interface StockMovementRepository {
    void save(StockMovement movement);
    default void saveAll(List<StockMovement> movements) {
        for (StockMovement movement : movements) save(movement);
    }
    List<StockMovement> findAll();
}
