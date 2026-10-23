package com.shop.orders;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class StripeClient {
    private final RestClient restClient;

    public StripeClient(RestClient.Builder builder) {
        this.restClient = builder.baseUrl("https://api.stripe.example.com").build();
    }

    public String charge(String order) {
        return restClient.post().uri("/v1/charges").body(order).retrieve().body(String.class);
    }
}
