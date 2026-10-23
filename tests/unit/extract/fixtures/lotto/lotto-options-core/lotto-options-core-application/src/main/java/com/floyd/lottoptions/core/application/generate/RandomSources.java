package com.floyd.lottoptions.core.application.generate;

import com.floyd.lottoptions.core.domain.generate.RandomSource;

import java.util.Objects;

/**
 * The {@link RandomSource} each {@link GenerationStrategy} draws from.
 *
 * <p>Production uses {@link #production()}: Balanced Spread and TEMPLATE_MATRIX take a fresh
 * {@code Random} per call, while Secure Random and Fast Random draw from {@code SecureRandom} and
 * {@code ThreadLocalRandom}, as their names promise. Tests can route every strategy through one
 * seeded source so that generation is reproducible.</p>
 *
 * @param perCall     the source of {@code LOW_ODD_LOW_EVEN_HIGH_ODD_HIGH_EVEN} and {@code TEMPLATE_MATRIX}
 * @param secure      the source of {@code SECURE_RANDOM}
 * @param threadLocal the source of {@code THREAD_LOCAL_RANDOM}
 */
public record RandomSources(RandomSource perCall, RandomSource secure, RandomSource threadLocal) {

    public RandomSources {
        Objects.requireNonNull(perCall, "perCall");
        Objects.requireNonNull(secure, "secure");
        Objects.requireNonNull(threadLocal, "threadLocal");
    }

    /**
     * Returns the production sources: {@link RandomSource#perCall()}, {@link RandomSource#secure()}
     * and {@link RandomSource#threadLocal()}.
     *
     * @return the production sources
     */
    public static RandomSources production() {
        return new RandomSources(RandomSource.perCall(), RandomSource.secure(), RandomSource.threadLocal());
    }

    /**
     * Returns the source the given strategy draws from.
     *
     * @param strategy the generation strategy
     * @return its source
     */
    public RandomSource forStrategy(GenerationStrategy strategy) {
        return switch (strategy) {
            case LOW_ODD_LOW_EVEN_HIGH_ODD_HIGH_EVEN, TEMPLATE_MATRIX -> perCall;
            case SECURE_RANDOM -> secure;
            case THREAD_LOCAL_RANDOM -> threadLocal;
        };
    }
}
