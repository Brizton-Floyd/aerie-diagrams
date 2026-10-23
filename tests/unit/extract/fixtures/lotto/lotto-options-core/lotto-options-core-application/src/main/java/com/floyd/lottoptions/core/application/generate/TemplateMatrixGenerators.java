package com.floyd.lottoptions.core.application.generate;

import com.floyd.lottoptions.core.domain.draw.DrawHistory;
import com.floyd.lottoptions.core.domain.generate.RandomSource;
import com.floyd.lottoptions.core.domain.generate.TicketGenerator;

/**
 * Builds the TEMPLATE_MATRIX strategy's generator, which still lives outside the core: Core's
 * adapter wraps the result analyzer's until S27b moves it into the domain.
 */
@FunctionalInterface
public interface TemplateMatrixGenerators {

    /**
     * @param history           the game and its draws
     * @param numberOfTickets   the tickets to generate in all
     * @param selectionStrategy the request's {@code templateSelectionStrategy}; {@code null}, blank
     *                          or unknown means the default
     * @param randomSource      the source of {@link java.util.Random}s
     * @return the generator
     */
    TicketGenerator create(DrawHistory history, int numberOfTickets, String selectionStrategy,
                           RandomSource randomSource);
}
