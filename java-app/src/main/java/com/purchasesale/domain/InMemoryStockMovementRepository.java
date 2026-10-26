package com.purchasesale.domain;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class InMemoryStockMovementRepository implements StockMovementRepository {
    private final List<StockMovement> movements = new ArrayList<StockMovement>();
    @Override public void save(StockMovement movement) { movements.add(movement); }
    @Override public List<StockMovement> findAll() { return Collections.unmodifiableList(new ArrayList<StockMovement>(movements)); }
}
