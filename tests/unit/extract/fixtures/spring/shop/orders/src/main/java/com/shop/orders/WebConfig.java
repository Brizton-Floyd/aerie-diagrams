package com.shop.orders;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
public class WebConfig {
    @Bean
    WebClient inventoryWebClient(InventoryProperties properties) {
        return WebClient.builder().baseUrl(properties.baseUrl()).build();
    }
}
