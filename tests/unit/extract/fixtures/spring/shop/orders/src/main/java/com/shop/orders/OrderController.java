package com.shop.orders;

import static com.shop.common.Paths.ORDERS;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ORDERS)
public class OrderController {
    private final OrderEvents events;

    public OrderController(OrderEvents events) {
        this.events = events;
    }

    @GetMapping("/{id}")
    public String get(@PathVariable String id) {
        return id;
    }

    @PostMapping
    public String create(@RequestBody String order) {
        events.created(order);
        return order;
    }

    @RequestMapping(path = "/{id}", method = {RequestMethod.PUT, RequestMethod.PATCH})
    public String update(@PathVariable String id) {
        return id;
    }
}
