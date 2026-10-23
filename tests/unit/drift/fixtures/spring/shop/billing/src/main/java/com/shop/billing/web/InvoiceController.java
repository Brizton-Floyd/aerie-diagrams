package com.shop.billing.web;

import com.shop.common.LedgerPort;
import com.shop.common.Money;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class InvoiceController {
    private final LedgerPort ledger;

    public InvoiceController(LedgerPort ledger) {
        this.ledger = ledger;
    }

    @PostMapping("/invoices")
    public String invoice(String order) {
        ledger.record(order, new Money(1000, "EUR"));
        return order;
    }
}
