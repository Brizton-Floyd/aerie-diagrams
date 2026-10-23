package com.shop.orders.billing;

import com.shop.common.Money;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

@Component
public class BillingClient {
    private final WebClient client;

    public BillingClient(WebClient.Builder builder, @Value("${billing.url}") String url) {
        this.client = builder.baseUrl(url).build();
    }

    public String invoice(String sku, Money price) {
        return client.post().uri("/invoices").retrieve().bodyToMono(String.class).block();
    }
}
