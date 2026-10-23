package com.floyd.lottoptions.core.server.adapter.templatematrix;

import com.floyd.analyzer.generator.strategy.categorical.TemplateMatrixLotteryNumberGenerator;
import com.floyd.analyzer.generator.strategy.categorical.TemplateMatrixLotteryNumberGenerator.TemplateSelectionStrategy;
import com.floyd.lottoptions.core.application.generate.TemplateMatrixGenerators;
import com.floyd.lottoptions.core.domain.draw.DrawHistory;
import com.floyd.lottoptions.core.domain.generate.RandomSource;
import com.floyd.lottoptions.core.domain.generate.TicketGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * The TEMPLATE_MATRIX generator of the result analyzer, until S27b moves it into the domain.
 *
 * <p>A missing or empty {@code templateSelectionStrategy} selects
 * {@link TemplateSelectionStrategy#BALANCED}; so does an unknown one, which is logged.</p>
 */
@Component
public class ResultAnalyzerTemplateMatrixGenerators implements TemplateMatrixGenerators {

    private static final Logger log = LoggerFactory.getLogger(ResultAnalyzerTemplateMatrixGenerators.class);

    @Override
    public TicketGenerator create(DrawHistory history, int numberOfTickets, String selectionStrategy,
                                  RandomSource randomSource) {
        return new TemplateMatrixLotteryNumberGenerator(history, numberOfTickets, strategyOf(selectionStrategy),
                randomSource);
    }

    private static TemplateSelectionStrategy strategyOf(String selectionStrategy) {
        if (selectionStrategy == null || selectionStrategy.isEmpty()) {
            return TemplateSelectionStrategy.BALANCED;
        }
        try {
            return TemplateSelectionStrategy.valueOf(selectionStrategy);
        } catch (IllegalArgumentException e) {
            log.warn("Invalid templateSelectionStrategy '{}', using default", selectionStrategy);
            return TemplateSelectionStrategy.BALANCED;
        }
    }
}
