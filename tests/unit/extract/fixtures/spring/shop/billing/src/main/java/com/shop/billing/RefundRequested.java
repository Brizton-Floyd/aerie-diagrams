package com.shop.billing;

import org.springframework.context.ApplicationEvent;

public class RefundRequested extends ApplicationEvent {
    public RefundRequested(Object source) {
        super(source);
    }
}
