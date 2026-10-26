package com.purchasesale.domain;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import java.util.Collections;

/** Stock rules behind purchase, sale, and transfer screens. */
public final class InventoryService {
    private final ItemRepository items;
    private final Map<String, BigDecimal> quantities = new HashMap<String, BigDecimal>();
    private final List<StockMovement> movements = new ArrayList<StockMovement>();
    private final StockMovementRepository movementRepository;

    public InventoryService(ItemRepository items) { this(items, new InMemoryStockMovementRepository()); }

    public InventoryService(ItemRepository items, StockMovementRepository movementRepository) {
        this.items = items;
        this.movementRepository = movementRepository;
        for (StockMovement movement : movementRepository.findAll()) {
            movements.add(movement);
            quantities.put(key(movement.getItemCode(), movement.getLocation()), stock(movement.getItemCode(), movement.getLocation()).add(movement.getQuantity()));
        }
    }

    private void record(StockMovement movement) {
        movementRepository.save(movement);
        movements.add(movement);
    }

    public BigDecimal receive(String itemCode, String location, BigDecimal quantity, BigDecimal rate) {
        requireItem(itemCode); requireLocation(location); requirePositive(quantity); requireNonNegative(rate);
        record(new StockMovement("SESSION", "UNNUMBERED", "PURCHASE", itemCode, location, quantity, rate));
        change(itemCode, location, quantity);
        return quantity.multiply(rate);
    }

    public BigDecimal sell(String itemCode, String location, BigDecimal quantity, BigDecimal rate) {
        requireItem(itemCode); requireLocation(location); requirePositive(quantity); requireNonNegative(rate);
        BigDecimal available = stock(itemCode, location);
        if (available.compareTo(quantity) < 0) throw new IllegalArgumentException("Insufficient stock for " + itemCode);
        record(new StockMovement("SESSION", "UNNUMBERED", "SALE", itemCode, location, quantity.negate(), rate));
        change(itemCode, location, quantity.negate());
        return quantity.multiply(rate);
    }

    public BigDecimal openingBalance(String itemCode, String location, BigDecimal quantity, BigDecimal rate) {
        requireItem(itemCode); requireLocation(location); requirePositive(quantity); requireNonNegative(rate);
        record(new StockMovement("SESSION", "OPENING", "OPENING", itemCode, location, quantity, rate));
        change(itemCode, location, quantity);
        return quantity.multiply(rate);
    }

    /** Posts every line only after validating the complete challan. */
    public BigDecimal post(Challan challan) {
        validateChallan(challan);
        List<StockMovement> pending = movementsFor(challan);
        movementRepository.saveAll(pending);
        applyMovements(pending);
        return challan.total();
    }

    public void validateChallan(Challan challan) {
        if (challan == null) throw new IllegalArgumentException("Challan is required");
        List<Challan.Line> lines = challan.getLines();
        Map<String, BigDecimal> saleQuantities = new HashMap<String, BigDecimal>();
        for (Challan.Line line : lines) {
            requireItem(line.getItemCode());
            requireLocation(challan.getLocation());
            requirePositive(line.getQuantity());
            requireNonNegative(line.getRate());
            if (challan.getType() == Challan.Type.SALE) {
                BigDecimal current = saleQuantities.get(line.getItemCode());
                saleQuantities.put(line.getItemCode(), (current == null ? BigDecimal.ZERO : current).add(line.getQuantity()));
            }
        }
        for (Map.Entry<String, BigDecimal> sale : saleQuantities.entrySet()) {
            if (stock(sale.getKey(), challan.getLocation()).compareTo(sale.getValue()) < 0) {
                throw new IllegalArgumentException("Insufficient stock for " + sale.getKey());
            }
        }
    }

    /** Applies in-memory stock after a caller has committed document and movement rows atomically. */
    public void applyPersistedChallan(Challan challan) {
        validateChallan(challan);
        applyMovements(movementsFor(challan));
    }

    private List<StockMovement> movementsFor(Challan challan) {
        List<StockMovement> pending = new ArrayList<StockMovement>();
        for (Challan.Line line : challan.getLines()) {
            BigDecimal movement = challan.getType() == Challan.Type.PURCHASE ? line.getQuantity() : line.getQuantity().negate();
            pending.add(new StockMovement(challan.getDate(), challan.getNumber(), challan.getType().name(), line.getItemCode(), challan.getLocation(), movement, line.getRate()));
        }
        return pending;
    }

    private void applyMovements(List<StockMovement> pending) {
        for (StockMovement movement : pending) {
            change(movement.getItemCode(), movement.getLocation(), movement.getQuantity());
            movements.add(movement);
        }
    }

    public void transfer(String itemCode, String from, String to, BigDecimal quantity) {
        requireItem(itemCode); requireLocation(from); requireLocation(to); requirePositive(quantity);
        if (from.equals(to)) throw new IllegalArgumentException("Source and destination must differ");
        if (stock(itemCode, from).compareTo(quantity) < 0) throw new IllegalArgumentException("Insufficient stock for transfer");
        List<StockMovement> transfer = new ArrayList<StockMovement>();
        transfer.add(new StockMovement("SESSION", "TRANSFER", "TRANSFER OUT", itemCode, from, quantity.negate(), BigDecimal.ZERO));
        transfer.add(new StockMovement("SESSION", "TRANSFER", "TRANSFER IN", itemCode, to, quantity, BigDecimal.ZERO));
        movementRepository.saveAll(transfer);
        change(itemCode, from, quantity.negate());
        change(itemCode, to, quantity);
        movements.addAll(transfer);
    }

    public BigDecimal stock(String itemCode, String location) {
        requireItem(itemCode); requireLocation(location);
        BigDecimal value = quantities.get(key(itemCode, location));
        return value == null ? BigDecimal.ZERO : value;
    }

    public List<StockMovement> movements() {
        return Collections.unmodifiableList(new ArrayList<StockMovement>(movements));
    }

    private void change(String itemCode, String location, BigDecimal amount) {
        quantities.put(key(itemCode, location), stock(itemCode, location).add(amount));
    }

    private String key(String itemCode, String location) { return itemCode + "@" + location; }
    private void requireItem(String code) { if (items.findByCode(code) == null) throw new IllegalArgumentException("Unknown item: " + code); }
    private void requireLocation(String value) { if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException("Location is required"); }
    private void requirePositive(BigDecimal value) { if (value == null || value.compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("Quantity must be positive"); }
    private void requireNonNegative(BigDecimal value) { if (value == null || value.compareTo(BigDecimal.ZERO) < 0) throw new IllegalArgumentException("Rate cannot be negative"); }
}
