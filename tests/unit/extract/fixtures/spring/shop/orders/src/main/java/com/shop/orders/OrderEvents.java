package com.shop.orders;

import com.shop.common.Paths.Topics;
import org.springframework.cloud.stream.function.StreamBridge;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class OrderEvents {
    private final KafkaTemplate<String, String> kafka;
    private final ApplicationEventPublisher publisher;
    private final StreamBridge bridge;

    public OrderEvents(KafkaTemplate<String, String> kafka, ApplicationEventPublisher publisher, StreamBridge bridge) {
        this.kafka = kafka;
        this.publisher = publisher;
        this.bridge = bridge;
    }

    public void created(String order) {
        kafka.send(Topics.ORDER_CREATED, order);
        publisher.publishEvent(new OrderPlaced(order));
        bridge.send("audit-out-0", order);
    }
}
