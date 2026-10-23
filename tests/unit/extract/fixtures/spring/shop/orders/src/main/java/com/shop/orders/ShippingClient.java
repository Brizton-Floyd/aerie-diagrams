package com.shop.orders;

import java.util.HashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
public class ShippingClient {
    private final RestTemplate restTemplate = new RestTemplate();
    private final Map<String, Integer> ticketsPerTemplate = new HashMap<>();

    @Value("${shipping.base-url:http://shipping:8090}")
    private String base;

    public String ship(String order) {
        ticketsPerTemplate.put(order, 1);
        restTemplate.postForObject(base + "/api/shipments", order, String.class);
        return restTemplate.exchange(String.format("%s/api/shipments/%s", base, order), HttpMethod.DELETE, null, String.class)
                .getBody();
    }
}
