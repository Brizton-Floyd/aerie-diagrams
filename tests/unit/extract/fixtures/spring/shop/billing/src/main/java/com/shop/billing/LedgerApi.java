package com.shop.billing;

import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.HttpExchange;

@HttpExchange("http://ledger.example.com/api")
public interface LedgerApi {
    @GetExchange("/entries/{id}")
    String entry(String id);
}
