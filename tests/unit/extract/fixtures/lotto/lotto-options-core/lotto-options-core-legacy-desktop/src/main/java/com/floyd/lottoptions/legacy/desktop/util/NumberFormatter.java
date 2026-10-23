package com.floyd.lottoptions.legacy.desktop.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.HashMap;

/**
 * Utility class for formatting numbers with consistent precision across the API.
 */
public class NumberFormatter {
    
    private static final int DEFAULT_DECIMAL_PLACES = 2;
    
    /**
     * Formats a double to 2 decimal places.
     */
    public static double formatToTwoDecimals(double value) {
        if (Double.isNaN(value) || Double.isInfinite(value)) {
            return value;
        }
        return BigDecimal.valueOf(value)
                .setScale(DEFAULT_DECIMAL_PLACES, RoundingMode.HALF_UP)
                .doubleValue();
    }
    
    /**
     * Formats all double values in a map to 2 decimal places.
     */
    public static Map<String, Double> formatMapValues(Map<String, Double> map) {
        if (map == null) {
            return null;
        }
        
        Map<String, Double> formatted = new HashMap<>();
        for (Map.Entry<String, Double> entry : map.entrySet()) {
            formatted.put(entry.getKey(), formatToTwoDecimals(entry.getValue()));
        }
        return formatted;
    }
    
    /**
     * Safely formats a Double (nullable) to 2 decimal places.
     */
    public static Double formatToTwoDecimals(Double value) {
        if (value == null) {
            return null;
        }
        return formatToTwoDecimals(value.doubleValue());
    }
}