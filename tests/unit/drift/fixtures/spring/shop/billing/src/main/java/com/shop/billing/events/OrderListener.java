package com.shop.billing.events;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class OrderListener {
    @KafkaListener(topics = "orders.created")
    public void created(String order) {
    }
}
