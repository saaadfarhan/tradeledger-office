package com.purchasesale.domain;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class InMemoryItemRepository implements ItemRepository {
    private final List<Item> items = new ArrayList<Item>();

    @Override public List<Item> findAll() {
        return Collections.unmodifiableList(new ArrayList<Item>(items));
    }

    @Override public Item findByCode(String code) {
        for (Item item : items) if (item.getCode().equals(code)) return item;
        return null;
    }

    @Override public void save(Item item) {
        if (findByCode(item.getCode()) != null) throw new IllegalArgumentException("Item code already exists: " + item.getCode());
        items.add(item);
    }

    @Override public void update(Item item) {
        if (item == null) throw new IllegalArgumentException("Item is required");
        for (int i = 0; i < items.size(); i++) if (items.get(i).getCode().equals(item.getCode())) {
            items.set(i, item);
            return;
        }
        throw new IllegalArgumentException("Item code does not exist: " + item.getCode());
    }

    @Override public void deleteByCode(String code) {
        for (int i = 0; i < items.size(); i++) if (items.get(i).getCode().equals(code)) {
            items.remove(i);
            return;
        }
        throw new IllegalArgumentException("Item code does not exist: " + code);
    }
}
