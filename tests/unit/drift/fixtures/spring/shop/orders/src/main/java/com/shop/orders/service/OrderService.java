package com.shop.orders.service;

import com.shop.catalog.CatalogService;
import com.shop.common.Money;
import com.shop.orders.billing.BillingClient;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class OrderService {
    private final CatalogService catalog = new CatalogService();
    private final BillingClient billing;
    private final KafkaTemplate<String, String> kafka;

    public OrderService(BillingClient billing, KafkaTemplate<String, String> kafka) {
        this.billing = billing;
        this.kafka = kafka;
    }

    public String place(String sku) {
        Money price = catalog.price(sku);
        kafka.send("orders.created", sku);
        return billing.invoice(sku, price);
    }
}
