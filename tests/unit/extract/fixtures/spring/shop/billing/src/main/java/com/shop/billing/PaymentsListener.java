package com.shop.billing;

import org.springframework.amqp.rabbit.annotation.Exchange;
import org.springframework.amqp.rabbit.annotation.Queue;
import org.springframework.amqp.rabbit.annotation.QueueBinding;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.jms.annotation.JmsListener;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class PaymentsListener {
    private static final String REFUNDS = "refunds";

    private final RabbitTemplate rabbit;

    PaymentsListener(RabbitTemplate rabbit) {
        this.rabbit = rabbit;
    }

    @KafkaListener(topics = "${topics.payments}")
    public void settled(String payment) {
        rabbit.convertAndSend("billing", "charge.done", payment);
    }

    @KafkaListener(topics = {"orders.created", "orders.cancelled"})
    public void orders(String order) {
        rabbit.convertAndSend(REFUNDS, order);
    }

    @RabbitListener(queues = REFUNDS)
    public void refund(String charge) {
    }

    @RabbitListener(bindings = @QueueBinding(value = @Queue("audit"), exchange = @Exchange("billing"), key = "charge.*"))
    public void audit(String event) {
    }

    @JmsListener(destination = "ledger.entries")
    public void ledger(String entry) {
    }
}
