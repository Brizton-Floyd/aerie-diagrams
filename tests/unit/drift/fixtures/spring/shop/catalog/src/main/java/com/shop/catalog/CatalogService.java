package com.shop.catalog;

import com.shop.common.Money;

public class CatalogService {
    public Money price(String sku) {
        return new Money(1000, "EUR");
    }
}
