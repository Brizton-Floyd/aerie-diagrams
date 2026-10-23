package com.shop.orders;

import java.util.concurrent.TimeUnit;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class Reminders {
    @Scheduled(fixedRate = 5, timeUnit = TimeUnit.MINUTES)
    public void remind() {
    }

    @Scheduled(cron = "${reminders.cron:0 0 9 * * MON-FRI}")
    public void weekly() {
    }

    @EventListener
    public void onPlaced(OrderPlaced event) {
    }
}
