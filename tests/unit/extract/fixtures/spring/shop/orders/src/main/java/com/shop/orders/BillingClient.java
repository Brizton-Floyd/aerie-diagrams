package com.shop.orders;

import com.shop.common.Paths;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;

@FeignClient(name = "billing", url = "${billing.url}")
public interface BillingClient {
    @PostMapping(Paths.CHARGES)
    String charge(String order);
}
