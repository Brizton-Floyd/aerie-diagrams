package com.shop.billing;

import com.shop.common.Paths;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ChargeController implements ChargeApi {
    @PostMapping({Paths.CHARGES, "/api/v2/charges"})
    public String charge(String order) {
        return order;
    }

    @Override
    public String refund(String charge) {
        return charge;
    }
}
