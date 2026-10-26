package com.purchasesale.domain;

import java.util.List;

public interface ItemRepository {
    List<Item> findAll();
    Item findByCode(String code);
    void save(Item item);
    void update(Item item);
    void deleteByCode(String code);
}
