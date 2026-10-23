package com.shop.common;

public interface LedgerPort {
    void record(String order, Money amount);
}
