package com.floyd.lottoptions.server.config;

import com.floyd.lottoptions.core.application.generate.RandomSources;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * Provides the clock and randomness seams injected into services.
 *
 * <p>Production uses the system clock in the default zone and
 * {@link RandomSources#production()}: a fresh, unseeded {@link java.util.Random} per call for
 * Balanced Spread and TEMPLATE_MATRIX, {@code SecureRandom} and {@code ThreadLocalRandom} for Secure
 * Random and Fast Random. Tests construct services with a fixed clock or seeded sources instead.</p>
 */
@Configuration
public class TimeAndRandomnessConfiguration {

    /**
     * The system clock in the JVM's default time zone.
     */
    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }

    /**
     * The random sources the ticket generators draw from, one per generation strategy.
     */
    @Bean
    public RandomSources randomSources() {
        return RandomSources.production();
    }
}
