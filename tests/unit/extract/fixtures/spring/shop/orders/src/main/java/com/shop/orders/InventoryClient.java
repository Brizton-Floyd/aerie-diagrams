package com.shop.orders;

import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

@Component
public class InventoryClient {
    private final WebClient webClient;
    private final InventoryProperties properties;

    public InventoryClient(WebClient webClient, InventoryProperties properties) {
        this.webClient = webClient;
        this.properties = properties;
    }

    public String stock(String sku) {
        String url = properties.stockUrl();
        return webClient.get().uri(url, sku).retrieve().bodyToMono(String.class).block();
    }

    public String reserve(String sku) {
        return webClient.post()
                .uri(builder -> builder.path("/v1/reservations").queryParam("sku", sku).build())
                .retrieve()
                .bodyToMono(String.class)
                .block();
    }
}
