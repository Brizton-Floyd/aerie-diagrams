package com.shop.orders;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.web.util.UriComponentsBuilder;

@ConfigurationProperties(prefix = "inventory")
public record InventoryProperties(String baseUrl, String stockPath) {
    public String stockUrl() {
        return UriComponentsBuilder.fromUriString(baseUrl).path(stockPath).toUriString();
    }
}
