package com.shop.billing.ledger;

import com.shop.common.LedgerPort;
import com.shop.common.Money;
import org.springframework.stereotype.Component;

@Component
public class Ledger implements LedgerPort {
    @Override
    public void record(String order, Money amount) {
    }
}
