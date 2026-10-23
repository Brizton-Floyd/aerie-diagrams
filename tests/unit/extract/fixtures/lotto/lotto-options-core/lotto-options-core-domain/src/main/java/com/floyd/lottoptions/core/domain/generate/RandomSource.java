package com.floyd.lottoptions.core.domain.generate;

import java.security.SecureRandom;
import java.util.Random;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Supplies the {@link Random} instances a ticket generator draws from.
 *
 * <p>Production uses {@link #perCall()}, {@link #secure()} or {@link #threadLocal()}, by
 * generation strategy. Tests supply a source that returns seeded instances, so that generation is
 * reproducible.</p>
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
     * Returns the source behind Balanced Spread and TEMPLATE_MATRIX: a new, unseeded
     * {@link Random} on every call.
     *
     * @return the per-call source
     */
    static RandomSource perCall() {
        return Random::new;
    }

    /**
     * Returns the source behind Secure Random: a new, self-seeded {@link SecureRandom} on every
     * call.
     *
     * @return the secure source
     */
    static RandomSource secure() {
        return SecureRandom::new;
    }

    /**
     * Returns the source behind Fast Random: the calling thread's {@link ThreadLocalRandom}. Use
     * the returned {@code Random} only on the thread that asked for it.
     *
     * @return the thread-local source
     */
    static RandomSource threadLocal() {
        return ThreadLocalRandom::current;
    }
}
