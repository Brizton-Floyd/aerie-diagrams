package com.floyd.lottoptions.core.server.config;

import com.floyd.lottoptions.core.application.betslip.PrintBetslip;
import com.floyd.lottoptions.core.application.catalog.ListCatalog;
import com.floyd.lottoptions.core.application.dashboard.LoadDashboard;
import com.floyd.lottoptions.core.application.draws.PageDrawHistory;
import com.floyd.lottoptions.core.application.gameout.RecommendGameOut;
import com.floyd.lottoptions.core.application.gameout.RecommendMultiState;
import com.floyd.lottoptions.core.application.generate.GenerateNumbers;
import com.floyd.lottoptions.core.application.generate.GenerateNumbers.SearchLimits;
import com.floyd.lottoptions.core.application.generate.RandomSources;
import com.floyd.lottoptions.core.application.generate.TemplateMatrixGenerators;
import com.floyd.lottoptions.core.application.generate.TicketGeneratorFactory;
import com.floyd.lottoptions.core.application.range.AnalyzeRanges;
import com.floyd.lottoptions.core.domain.betslip.BetslipRenderer;
import com.floyd.lottoptions.core.domain.catalog.GameCatalogSource;
import com.floyd.lottoptions.core.domain.draw.DrawHistorySource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * Wires the framework-free use cases of the application module to their adapters.
 */
@Configuration(proxyBeanMethods = false)
public class UseCaseConfiguration {

    @Bean
    public ListCatalog listCatalog(GameCatalogSource catalogSource) {
        return new ListCatalog(catalogSource);
    }

    @Bean
    public PrintBetslip printBetslip(BetslipRenderer betslipRenderer) {
        return new PrintBetslip(betslipRenderer);
    }

    @Bean
    public LoadDashboard loadDashboard(DrawHistorySource drawHistorySource) {
        return new LoadDashboard(drawHistorySource);
    }

    @Bean
    public AnalyzeRanges analyzeRanges(DrawHistorySource drawHistorySource) {
        return new AnalyzeRanges(drawHistorySource);
    }

    @Bean
    public PageDrawHistory pageDrawHistory(DrawHistorySource drawHistorySource) {
        return new PageDrawHistory(drawHistorySource);
    }

    @Bean
    public GenerateNumbers generateNumbers(DrawHistorySource drawHistorySource, RandomSources randomSources,
                                           TemplateMatrixGenerators templateMatrixGenerators) {
        return new GenerateNumbers(drawHistorySource,
                new TicketGeneratorFactory(randomSources, templateMatrixGenerators), SearchLimits.DEFAULT);
    }

    @Bean
    public RecommendGameOut recommendGameOut(DrawHistorySource drawHistorySource, Clock clock) {
        return new RecommendGameOut(drawHistorySource, clock);
    }

    @Bean
    public RecommendMultiState recommendMultiState(GameCatalogSource catalogSource,
                                                   DrawHistorySource drawHistorySource,
                                                   RecommendGameOut recommendGameOut, Clock clock) {
        return new RecommendMultiState(catalogSource, drawHistorySource, recommendGameOut, clock);
    }
}
