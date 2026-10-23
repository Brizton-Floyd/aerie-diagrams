package com.floyd.lottoptions.core.application.generate;

import com.floyd.lottoptions.core.domain.draw.DrawHistory;
import com.floyd.lottoptions.core.domain.generate.RandomSource;
import com.floyd.lottoptions.core.domain.generate.TicketGenerator;
import com.floyd.lottoptions.core.domain.generate.balanced.BalancedSpreadGenerator;
import com.floyd.lottoptions.core.domain.generate.uniform.UniformGenerator;

import java.util.Objects;

/**
 * Builds the {@link TicketGenerator} of a generation strategy, fed by that strategy's
 * {@link RandomSource}.
 */
public final class TicketGeneratorFactory {

    private final RandomSources randomSources;
    private final TemplateMatrixGenerators templateMatrixGenerators;

    /**
     * @param randomSources            the source each strategy draws from
     * @param templateMatrixGenerators builds the TEMPLATE_MATRIX generator
     */
    public TicketGeneratorFactory(RandomSources randomSources, TemplateMatrixGenerators templateMatrixGenerators) {
        this.randomSources = Objects.requireNonNull(randomSources, "randomSources");
        this.templateMatrixGenerators = Objects.requireNonNull(templateMatrixGenerators, "templateMatrixGenerators");
    }

    /**
     * @param strategy                  the generation strategy
     * @param history                   the game and its draws
     * @param numberSetsPerPattern      the request's {@code numberSetsPerPattern}: the tickets per
     *                                  hot spread for Balanced Spread, the tickets in all otherwise
     * @param templateSelectionStrategy the request's {@code templateSelectionStrategy}, read by
     *                                  TEMPLATE_MATRIX only; may be {@code null}
     * @return the generator
     * @throws IllegalArgumentException if Secure Random or Fast Random cannot draw that many
     *                                  distinct tickets for the game
     */
    public TicketGenerator create(GenerationStrategy strategy, DrawHistory history, int numberSetsPerPattern,
                                  String templateSelectionStrategy) {
        RandomSource randomSource = randomSources.forStrategy(strategy);
        return switch (strategy) {
            case LOW_ODD_LOW_EVEN_HIGH_ODD_HIGH_EVEN ->
                    new BalancedSpreadGenerator(history, numberSetsPerPattern, randomSource);
            case TEMPLATE_MATRIX -> templateMatrixGenerators.create(history, numberSetsPerPattern,
                    templateSelectionStrategy, randomSource);
            case SECURE_RANDOM, THREAD_LOCAL_RANDOM ->
                    new UniformGenerator(history.game(), numberSetsPerPattern, randomSource);
        };
    }
}
