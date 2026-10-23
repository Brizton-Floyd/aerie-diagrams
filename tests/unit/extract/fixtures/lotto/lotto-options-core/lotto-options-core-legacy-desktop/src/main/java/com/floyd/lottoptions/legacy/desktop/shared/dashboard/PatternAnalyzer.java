package com.floyd.lottoptions.legacy.desktop.shared.dashboard;

import com.floyd.model.dashboard.PatternAnalysisResult;
import com.floyd.persistence.model.LotteryGame;

import java.util.Map;

/**
 * Defines a contract for classes that analyze lottery game data to find statistical patterns.
 * Implementations of this interface are expected to process a lottery game's history and produce a set of
 * analysis results, which can then be retrieved, filtered, and sorted.
 */
public interface PatternAnalyzer {

    /**
     * Analyzes the historical data of a given lottery game.
     * This method should perform the core analysis, calculating frequencies, probabilities,
     * and other relevant metrics for the patterns it identifies.
     *
     * @param lotteryGame The lottery game to be analyzed, containing its draw history.
     */
    void analyze(LotteryGame lotteryGame);

    /**
     * Retrieves the results of the pattern analysis.
     * The results are returned as a map where the key is a string representation of the pattern
     * and the value is a {@link PatternAnalysisResult} object containing detailed metrics.
     *
     * @return A map of pattern analysis results.
     */
    Map<String, PatternAnalysisResult> getPatternResults();

    /**
     * Filters and sorts the analysis results.
     * This method should refine the list of pattern results, for example, by removing patterns that
     * have not appeared recently or by sorting them based on statistical significance.
     */
    void filterAndSortResults();
}
