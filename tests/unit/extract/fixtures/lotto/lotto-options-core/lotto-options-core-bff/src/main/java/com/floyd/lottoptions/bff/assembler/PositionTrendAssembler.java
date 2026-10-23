package com.floyd.lottoptions.bff.assembler;

import com.floyd.lottoptions.bff.viewmodel.PositionTrendViewModel;
import com.floyd.lottoptions.bff.viewmodel.TrendAnalysisViewModel;
import com.floyd.lottoptions.bff.viewmodel.TrendIndicatorsViewModel;
import com.floyd.lottoptions.bff.viewmodel.TrendPeriodViewModel;
import com.floyd.lottoptions.core.contract.dashboard.DrawResultPattern;
import com.floyd.lottoptions.core.contract.dashboard.LotteryNumber;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Pure assembler that derives the Position Trend chart data from draw history.
 *
 * <p>Mirrors {@code PositionTrendService.analyzePositionTrends}
 * (PositionTrendService.java:20–265, FR-006-D, ADR-0003). Buckets draws into
 * periods of 5, computes OHLC + hit metrics per period, calculates MA5/10/20,
 * and derives technical indicators and position-level analysis.</p>
 *
 * <p>Deliberate divergences from the desktop:</p>
 * <ul>
 *   <li>All {@code Math.random()} calls from the per-segment chart are absent -
 *       uses real frequency data.</li>
 *   <li>Chart-type selector is not reproduced (decorative in desktop).</li>
 * </ul>
 *
 * <p>This class is {@code final} (Effective Java Items 17, 19). No I/O, no reactive types.</p>
 */
@Component
public final class PositionTrendAssembler {

    /** Period size in draws (mirrors desktop periodSize=5). */
    static final int PERIOD_SIZE = 5;

    private static final Set<String> VALID_RANGES = Set.of("30", "60", "90", "all");

    /**
     * Builds the Position Trend view model.
     *
     * @param allPatterns the complete draw history (oldest to newest); must not be {@code null}
     * @param position    1-based draw position to analyse; must be &gt;= 1
     * @param range       "30" | "60" | "90" | "all"; defaults to "30" if unrecognised
     * @return position trend view model; empty points list if insufficient data
     * @throws NullPointerException     if allPatterns or range is null
     * @throws IllegalArgumentException if position &lt; 1
     */
    public PositionTrendViewModel buildPositionTrend(
            List<DrawResultPattern> allPatterns, int position, String range) {
        Objects.requireNonNull(allPatterns, "allPatterns must not be null");
        Objects.requireNonNull(range, "range must not be null");
        if (position < 1) {
            throw new IllegalArgumentException("position must be >= 1, got: " + position);
        }

        String effectiveRange = VALID_RANGES.contains(range) ? range : "30";

        if (allPatterns.isEmpty()) {
            return emptyTrend(position, effectiveRange);
        }

        // Filter draws by range (mirrors filterDrawsByTimeRange: subList from FRONT)
        List<DrawResultPattern> filtered = filterByRange(allPatterns, effectiveRange);

        // Extract GO values for the chosen position across filtered draws
        List<Integer> goValues = extractGoValuesAtPosition(filtered, position);

        if (goValues.isEmpty()) {
            return emptyTrend(position, effectiveRange);
        }

        // Bucket into periods of 5
        List<TrendPeriodViewModel> periods = buildPeriods(goValues);

        // Compute aggregate indicators
        TrendIndicatorsViewModel indicators = computeIndicators(periods);

        // Compute position-level analysis
        TrendAnalysisViewModel analysis = computeAnalysis(filtered, position, periods);

        // Attach MAs to each period
        List<TrendPeriodViewModel> periodsWithMa = attachMovingAverages(periods);

        return new PositionTrendViewModel(position, effectiveRange, List.copyOf(periodsWithMa), indicators, analysis);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private List<DrawResultPattern> filterByRange(List<DrawResultPattern> patterns, String range) {
        if ("all".equals(range)) return patterns;
        int maxDraws = Integer.parseInt(range);
        // Mirror desktop: subList(0, maxDraws) from the FRONT - but then we use these
        // as the most-recent N draws (desktop uses a subList of the filtered list).
        // PositionTrendService.java:50–69 takes subList(0, maxDraws), which is the OLDEST N draws.
        // We match that semantics for parity.
        if (patterns.size() <= maxDraws) return patterns;
        return patterns.subList(0, maxDraws);
    }

    private List<Integer> extractGoValuesAtPosition(List<DrawResultPattern> patterns, int position) {
        int idx = position - 1; // 0-based
        List<Integer> result = new ArrayList<>(patterns.size());
        for (DrawResultPattern pattern : patterns) {
            List<LotteryNumber> numbers = pattern.lotteryNumbers();
            if (numbers != null && idx < numbers.size()) {
                result.add(numbers.get(idx).gamesOut());
            }
        }
        return result;
    }

    private List<TrendPeriodViewModel> buildPeriods(List<Integer> goValues) {
        List<TrendPeriodViewModel> periods = new ArrayList<>();
        int numPeriods = goValues.size() / PERIOD_SIZE;
        for (int i = 0; i < numPeriods; i++) {
            int start = i * PERIOD_SIZE;
            List<Integer> bucket = goValues.subList(start, start + PERIOD_SIZE);
            int open  = bucket.get(0);
            int close = bucket.get(bucket.size() - 1);
            int high  = bucket.stream().mapToInt(Integer::intValue).max().orElse(open);
            int low   = bucket.stream().mapToInt(Integer::intValue).min().orElse(open);
            long hitCount = bucket.stream().filter(go -> go == 0).count();
            double hitFrequency = (double) hitCount / PERIOD_SIZE;
            String trend = deriveTrend(open, close);
            // MA values will be attached in a later pass
            periods.add(new TrendPeriodViewModel(
                    "T" + (i + 1), open, high, low, close,
                    (int) hitCount, hitFrequency, trend,
                    null, null, null));
        }
        return periods;
    }

    private List<TrendPeriodViewModel> attachMovingAverages(List<TrendPeriodViewModel> periods) {
        List<Integer> closes = periods.stream()
                .map(TrendPeriodViewModel::close)
                .collect(Collectors.toList());
        List<TrendPeriodViewModel> result = new ArrayList<>(periods.size());
        for (int i = 0; i < periods.size(); i++) {
            TrendPeriodViewModel p = periods.get(i);
            Double ma5  = movingAverage(closes, i, 5);
            Double ma10 = movingAverage(closes, i, 10);
            Double ma20 = movingAverage(closes, i, 20);
            result.add(new TrendPeriodViewModel(
                    p.label(), p.open(), p.high(), p.low(), p.close(),
                    p.hitCount(), p.hitFrequency(), p.trend(),
                    ma5, ma10, ma20));
        }
        return result;
    }

    /**
     * Computes a moving average ending at index {@code endIdx} (inclusive) over
     * the last {@code window} values. Returns {@code null} if insufficient data.
     */
    private Double movingAverage(List<Integer> closes, int endIdx, int window) {
        if (endIdx + 1 < window) return null; // not enough history yet
        int fromIdx = endIdx - window + 1;
        double sum = 0.0;
        for (int i = fromIdx; i <= endIdx; i++) {
            sum += closes.get(i);
        }
        return sum / window;
    }

    private TrendIndicatorsViewModel computeIndicators(List<TrendPeriodViewModel> periods) {
        if (periods.isEmpty()) {
            return new TrendIndicatorsViewModel(0.0, 0.0, 0.0, null);
        }
        List<Integer> closes = periods.stream().map(TrendPeriodViewModel::close).toList();

        // Trend strength: proportion of periods with consistent trend direction
        long bullish = periods.stream().filter(p -> "BULLISH".equals(p.trend())).count();
        long bearish = periods.stream().filter(p -> "BEARISH".equals(p.trend())).count();
        double trendStrength = (double) Math.max(bullish, bearish) / periods.size();

        // Volatility: std dev of close values
        double mean = closes.stream().mapToInt(Integer::intValue).average().orElse(0);
        double variance = closes.stream()
                .mapToDouble(c -> (c - mean) * (c - mean))
                .average().orElse(0);
        double volatility = Math.sqrt(variance);

        double avgHitFreq = periods.stream()
                .mapToDouble(TrendPeriodViewModel::hitFrequency)
                .average().orElse(0.0);

        Double rsi14 = computeRsi14(closes);

        return new TrendIndicatorsViewModel(trendStrength, volatility, avgHitFreq, rsi14);
    }

    /**
     * Computes the 14-period Wilder RSI for the last element of the {@code closes}
     * series.  Returns {@code null} when fewer than 15 values are available
     * (RSI requires at least 15 data points: 14 changes for the initial SMA seed
     * plus one look-ahead value for the final result).
     *
     * <p>Formula (standard Wilder RSI):</p>
     * <pre>
     *   gain[i] = max(closes[i] - closes[i-1], 0)
     *   loss[i] = max(closes[i-1] - closes[i], 0)
     *   avgGain (seed) = SMA of first 14 gains (indices 1..14)
     *   avgLoss (seed) = SMA of first 14 losses (indices 1..14)
     *   for i = 15 .. n-1: Wilder smoothing
     *       avgGain = (avgGain * 13 + gain[i]) / 14
     *       avgLoss = (avgLoss * 13 + loss[i]) / 14
     *   RS  = avgGain / avgLoss  (100 when avgLoss == 0)
     *   RSI = 100 - (100 / (1 + RS))
     * </pre>
     *
     * @param closes the ordered close series; must not be {@code null}
     * @return RSI value in [0, 100] for the last close, or {@code null} if insufficient data
     */
    Double computeRsi14(List<Integer> closes) {
        if (closes.size() < 15) {
            return null;
        }

        // Build gains / losses arrays (index 0 unused; index i = change from closes[i-1] to closes[i])
        int n = closes.size();
        double[] gains = new double[n];
        double[] losses = new double[n];
        for (int i = 1; i < n; i++) {
            double change = closes.get(i) - closes.get(i - 1);
            gains[i]  = change > 0 ? change : 0.0;
            losses[i] = change < 0 ? -change : 0.0;
        }

        // Seed: SMA of first 14 changes (indices 1..14)
        double avgGain = 0.0;
        double avgLoss = 0.0;
        for (int i = 1; i <= 14; i++) {
            avgGain += gains[i];
            avgLoss += losses[i];
        }
        avgGain /= 14.0;
        avgLoss /= 14.0;

        // Wilder smoothing for indices 15..n-1
        for (int i = 15; i < n; i++) {
            avgGain = (avgGain * 13.0 + gains[i]) / 14.0;
            avgLoss = (avgLoss * 13.0 + losses[i]) / 14.0;
        }

        // Division-by-zero guard: avgLoss == 0 → RS treated as infinity → RSI = 100
        double rs = (avgLoss == 0.0) ? Double.MAX_VALUE : (avgGain / avgLoss);
        return 100.0 - (100.0 / (1.0 + rs));
    }

    private TrendAnalysisViewModel computeAnalysis(
            List<DrawResultPattern> patterns, int position, List<TrendPeriodViewModel> periods) {

        int posIdx = position - 1;

        // Count number frequency at this position across all filtered draws
        Map<Integer, Integer> numberFreq = new HashMap<>();
        for (DrawResultPattern pattern : patterns) {
            List<LotteryNumber> numbers = pattern.lotteryNumbers();
            if (numbers != null && posIdx < numbers.size()) {
                LotteryNumber ln = numbers.get(posIdx);
                if (ln.gamesOut() == 0) { // only count hits at this position
                    numberFreq.merge(ln.number(), 1, Integer::sum);
                }
            }
        }

        // Hot numbers: top-5 by frequency
        List<Integer> hotNumbers = numberFreq.entrySet().stream()
                .sorted(Map.Entry.<Integer, Integer>comparingByValue().reversed())
                .limit(5)
                .map(Map.Entry::getKey)
                .toList();

        // Cold numbers: bottom-5 (least frequent hit at this position)
        List<Integer> coldNumbers = numberFreq.entrySet().stream()
                .sorted(Map.Entry.comparingByValue())
                .limit(5)
                .map(Map.Entry::getKey)
                .toList();

        // Primary trend from majority of periods
        long bullish = periods.stream().filter(p -> "BULLISH".equals(p.trend())).count();
        long bearish = periods.stream().filter(p -> "BEARISH".equals(p.trend())).count();
        String primaryTrend;
        double confidence;
        if (periods.isEmpty()) {
            primaryTrend = "SIDEWAYS";
            confidence = 0.0;
        } else if (bullish > bearish) {
            primaryTrend = "BULLISH";
            confidence = (double) bullish / periods.size();
        } else if (bearish > bullish) {
            primaryTrend = "BEARISH";
            confidence = (double) bearish / periods.size();
        } else {
            primaryTrend = "SIDEWAYS";
            confidence = 0.5;
        }

        List<String> insights = buildInsights(primaryTrend, confidence, hotNumbers);

        return new TrendAnalysisViewModel(primaryTrend, confidence,
                List.copyOf(hotNumbers), List.copyOf(coldNumbers), List.copyOf(insights));
    }

    private List<String> buildInsights(String primaryTrend, double confidence, List<Integer> hotNumbers) {
        List<String> insights = new ArrayList<>();
        insights.add("Primary trend: " + primaryTrend + " (confidence: " +
                String.format("%.0f%%", confidence * 100) + ")");
        if (!hotNumbers.isEmpty()) {
            insights.add("Most frequent numbers at this position: " + hotNumbers);
        }
        return insights;
    }

    /**
     * Derives trend direction from OHLC open vs close.
     * Preserves desktop convention: close &gt; open = BULLISH (higher GO),
     * close &lt; open = BEARISH (lower GO / more recent hit).
     */
    private String deriveTrend(int open, int close) {
        if (close > open)  return "BULLISH";
        if (close < open)  return "BEARISH";
        return "SIDEWAYS";
    }

    private PositionTrendViewModel emptyTrend(int position, String range) {
        return new PositionTrendViewModel(
                position, range, List.of(),
                new TrendIndicatorsViewModel(0.0, 0.0, 0.0, null),
                new TrendAnalysisViewModel("SIDEWAYS", 0.0, List.of(), List.of(), List.of()));
    }
}
