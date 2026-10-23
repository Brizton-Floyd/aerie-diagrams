package com.shop.billing;

import org.springframework.web.bind.annotation.DeleteMapping;

/** The refund request, declared on an interface as generated API code does. */
public interface ChargeApi {
    @DeleteMapping("/api/charges/{charge}")
    String refund(String charge);
}
