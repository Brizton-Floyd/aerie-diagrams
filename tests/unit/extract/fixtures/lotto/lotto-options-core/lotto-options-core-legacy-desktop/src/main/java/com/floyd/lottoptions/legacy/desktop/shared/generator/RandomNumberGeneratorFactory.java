package com.floyd.lottoptions.legacy.desktop.shared.generator;

import com.floyd.lottoptions.legacy.desktop.shared.generator.strategy.categorical.LowOddLowEvenHighOddHighEvenLotteryNumberGenerator;
import com.floyd.lottoptions.legacy.desktop.shared.generator.strategy.categorical.TemplateMatrixLotteryNumberGenerator;
import com.floyd.lottoptions.legacy.desktop.shared.generator.strategy.categorical.TemplateMatrixLotteryNumberGenerator.TemplateSelectionStrategy;
import com.floyd.lottoptions.legacy.desktop.shared.generator.strategy.uniform.UniformLotteryNumberGenerator;
import com.floyd.persistence.model.LotteryGame;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * A factory for creating instances of {@link LotteryNumberGenerator}.
 * This class provides a centralized way to instantiate different types of lottery number generators based on the
 * specified generation strategy.
 */
public class RandomNumberGeneratorFactory {

    /**
     * An enumeration of the available lottery number generator types.
     * Each enum constant corresponds to a specific generation strategy.
     */
    public enum GeneratorType {
        /**
         * A generator that uses a categorical strategy based on low/high and odd/even distributions.
         */
        LOW_ODD_LOW_EVEN_HIGH_ODD_HIGH_EVEN,
        
        /**
         * A generator that uses TemplateMatrix methodology for intelligent pattern selection.
         */
        TEMPLATE_MATRIX,

        /**
         * Uniform draws from a {@link java.security.SecureRandom} (the Web UI's "Secure Random").
         * Clients send it as {@code SecureRandom}.
         */
        SECURE_RANDOM("SecureRandom"),

        /**
         * Uniform draws from {@link java.util.concurrent.ThreadLocalRandom} (the Web UI's "Fast Random").
         * Clients send it as {@code ThreadLocalRandom}.
         */
        THREAD_LOCAL_RANDOM("ThreadLocalRandom");

        private final List<String> wireNames;

        GeneratorType(String... aliases) {
            List<String> names = new ArrayList<>();
            names.add(name());
            names.addAll(List.of(aliases));
            this.wireNames = List.copyOf(names);
        }

        /**
         * Looks up the generator type a client names, accepting both the constant's name and its alias
         * (for example {@code SECURE_RANDOM} and {@code SecureRandom}). The match is case-sensitive.
         *
         * @param wireName the {@code numberGenerator} value a client sent; may be {@code null}
         * @return the matching type, or empty if the value names no type
         */
        public static Optional<GeneratorType> fromWireName(String wireName) {
            if (wireName == null) {
                return Optional.empty();
            }
            return Arrays.stream(values())
                    .filter(type -> type.wireNames.contains(wireName))
                    .findFirst();
        }

        /**
         * Returns every value {@link #fromWireName(String)} accepts, in declaration order.
         *
         * @return an unmodifiable list of the accepted wire names
         */
        public static List<String> acceptedWireNames() {
            return Arrays.stream(values())
                    .flatMap(type -> type.wireNames.stream())
                    .toList();
        }
    }

    /**
     * Creates and returns a {@link LotteryNumberGenerator} based on the specified type.
     *
     * @param type                 The type of generator to create, as defined in the {@link GeneratorType} enum.
     * @param lotteryGame          The lottery game for which to generate numbers.
     * @param numberSetsPerPattern The number of ticket sets to generate for each identified pattern.
     * @return An instance of a {@link LotteryNumberGenerator} corresponding to the specified type.
     * @throws IllegalArgumentException if the specified generator type is invalid.
     */
    public static LotteryNumberGenerator createGenerator(GeneratorType type, LotteryGame lotteryGame, int numberSetsPerPattern) {
        return createGenerator(type, lotteryGame, numberSetsPerPattern, null);
    }
    
    /**
     * Creates and returns a {@link LotteryNumberGenerator} based on the specified type with template selection strategy.
     *
     * @param type                 The type of generator to create, as defined in the {@link GeneratorType} enum.
     * @param lotteryGame          The lottery game for which to generate numbers.
     * @param numberSetsPerPattern The number of ticket sets to generate for each identified pattern.
     * @param templateStrategy     The template selection strategy (only used for TEMPLATE_MATRIX type).
     * @return An instance of a {@link LotteryNumberGenerator} corresponding to the specified type.
     * @throws IllegalArgumentException if the specified generator type is invalid.
     */
    public static LotteryNumberGenerator createGenerator(GeneratorType type, LotteryGame lotteryGame, 
                                                       int numberSetsPerPattern, TemplateSelectionStrategy templateStrategy) {
        return createGenerator(type, lotteryGame, numberSetsPerPattern, templateStrategy,
                RandomSources.production().forType(type));
    }

    /**
     * Creates and returns a {@link LotteryNumberGenerator} that draws its randomness from the given source.
     *
     * @param type                 The type of generator to create, as defined in the {@link GeneratorType} enum.
     * @param lotteryGame          The lottery game for which to generate numbers.
     * @param numberSetsPerPattern The number of ticket sets to generate for each identified pattern.
     * @param templateStrategy     The template selection strategy (only used for TEMPLATE_MATRIX type).
     * @param randomSource         The source of {@link java.util.Random} instances the generator uses;
     *                             {@link RandomSources#forType(GeneratorType)} gives the production one per type.
     * @return An instance of a {@link LotteryNumberGenerator} corresponding to the specified type.
     * @throws IllegalArgumentException if the specified generator type is invalid.
     */
    public static LotteryNumberGenerator createGenerator(GeneratorType type, LotteryGame lotteryGame,
                                                       int numberSetsPerPattern, TemplateSelectionStrategy templateStrategy,
                                                       RandomSource randomSource) {
        switch (type) {
            case LOW_ODD_LOW_EVEN_HIGH_ODD_HIGH_EVEN:
                return new LowOddLowEvenHighOddHighEvenLotteryNumberGenerator(lotteryGame, numberSetsPerPattern, randomSource);
                
            case TEMPLATE_MATRIX:
                if (templateStrategy != null) {
                    return new TemplateMatrixLotteryNumberGenerator(lotteryGame, numberSetsPerPattern, templateStrategy, randomSource);
                } else {
                    return new TemplateMatrixLotteryNumberGenerator(lotteryGame, numberSetsPerPattern, randomSource);
                }

            case SECURE_RANDOM:
            case THREAD_LOCAL_RANDOM:
                return new UniformLotteryNumberGenerator(lotteryGame, numberSetsPerPattern, randomSource);
                
            default:
                throw new IllegalArgumentException("Invalid generator type: " + type);
        }
    }
}
