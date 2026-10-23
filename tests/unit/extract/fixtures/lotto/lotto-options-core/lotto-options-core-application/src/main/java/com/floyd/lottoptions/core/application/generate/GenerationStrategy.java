package com.floyd.lottoptions.core.application.generate;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * The generation strategies a generate request can name, by its {@code numberGenerator}.
 */
public enum GenerationStrategy {

    /** Balanced Spread: tickets that fill the game's hot low/high and odd/even spreads. */
    LOW_ODD_LOW_EVEN_HIGH_ODD_HIGH_EVEN,

    /** Tickets picked by the TemplateMatrix methodology. */
    TEMPLATE_MATRIX,

    /**
     * Secure Random: uniform draws from a {@link java.security.SecureRandom}. Clients send it as
     * {@code SecureRandom}.
     */
    SECURE_RANDOM("SecureRandom"),

    /**
     * Fast Random: uniform draws from {@link java.util.concurrent.ThreadLocalRandom}. Clients send
     * it as {@code ThreadLocalRandom}.
     */
    THREAD_LOCAL_RANDOM("ThreadLocalRandom");

    private final List<String> wireNames;

    GenerationStrategy(String... aliases) {
        List<String> names = new ArrayList<>();
        names.add(name());
        names.addAll(List.of(aliases));
        this.wireNames = List.copyOf(names);
    }

    /**
     * Looks up the strategy a client names, accepting both the constant's name and its alias (for
     * example {@code SECURE_RANDOM} and {@code SecureRandom}). The match is case-sensitive.
     *
     * @param wireName the {@code numberGenerator} value a client sent; may be {@code null}
     * @return the matching strategy, or empty if the value names none
     */
    public static Optional<GenerationStrategy> fromWireName(String wireName) {
        if (wireName == null) {
            return Optional.empty();
        }
        return Arrays.stream(values())
                .filter(strategy -> strategy.wireNames.contains(wireName))
                .findFirst();
    }

    /**
     * Returns every value {@link #fromWireName(String)} accepts, in declaration order.
     *
     * @return an unmodifiable list of the accepted wire names
     */
    public static List<String> acceptedWireNames() {
        return Arrays.stream(values())
                .flatMap(strategy -> strategy.wireNames.stream())
                .toList();
    }
}
