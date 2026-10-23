package com.shop.billing;

import org.springframework.context.ApplicationListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class RefundJob implements ApplicationListener<RefundRequested> {
    @Scheduled(fixedDelayString = "PT30S")
    public void sweep() {
    }

    @Override
    public void onApplicationEvent(RefundRequested event) {
    }
}
