package com.shop.common;

/** The addresses and channels the services share. */
public final class Paths {
    public static final String API = "/api";
    public static final String ORDERS = API + "/orders";
    public static final String CHARGES = API + "/charges";

    private Paths() {
    }

    public static final class Topics {
        public static final String ORDER_CREATED = "orders.created";

        private Topics() {
        }
    }
}
