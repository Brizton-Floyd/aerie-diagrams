package com.floyd.lottoptions.legacy.desktop.shared.generator;

import java.security.SecureRandom;
import java.util.Random;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Supplies the {@link Random} instances a lottery number generator draws from.
 *
 * <p>Production code uses {@link #perCall()}, which constructs a fresh, unseeded
 * {@code Random} on every call - exactly the per-call construction the generators
 * performed before this seam existed. Tests can supply a source that returns
 * seeded instances so that generation is reproducible.</p>
 */
@FunctionalInterface
public interface RandomSource {

    /**
     * Returns the {@link Random} to use for the next unit of generation work.
     *
     * @return a non-null {@code Random}
     */
    Random next();

    /**
     * Returns the production source: a new, unseeded {@link Random} on every call.
     *
     * @return the per-call source
     */
    static RandomSource perCall() {
        return Random::new;
    }

    /**
     * Returns the source behind the Secure Random strategy: a new, self-seeded
     * {@link SecureRandom} on every call.
     *
     * @return the secure source
     */
    static RandomSource secure() {
        return SecureRandom::new;
    }

    /**
     * Returns the source behind the Fast Random strategy: the calling thread's
     * {@link ThreadLocalRandom}. Use the returned {@code Random} only on the thread that asked for it.
     *
     * @return the thread-local source
     */
    static RandomSource threadLocal() {
        return ThreadLocalRandom::current;
    }
}
