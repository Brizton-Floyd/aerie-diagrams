package com.floyd.lottoptions.bff.assembler;

import com.floyd.lottoptions.bff.viewmodel.NumberFrequencyViewModel;
import com.floyd.lottoptions.bff.viewmodel.RangeRollupViewModel;
import com.floyd.lottoptions.core.contract.dashboard.DrawResultPattern;
import com.floyd.lottoptions.core.contract.dashboard.LotteryNumber;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Pure assembler that derives the Games-Out Frequency panel data from the full
 * draw history (FR-006-D, ADR-0003).
 *
 * <p>Mirrors {@code setUpGamesOutFrequencyAnalysis} and
 * {@code calculateGOValueStats} (DashBoardController.java:438–587). Computes per-number
 * zone, frequency percent, range frequency (transitions to GO==0 within the range), and
 * draws-ago (since GO last produced a hit in range).</p>
 *
 * <p>Zone classification: HOT = GO 0–9, WARM = GO 10–19, COLD = GO 20+.</p>
 *
 * <p>This class is {@code final} (Effective Java Items 17, 19). Constructor injection
 * is not required - no dependencies. No I/O, no reactive types.</p>
 */
@Component
public final class FrequencyRollupAssembler {

    /** Range size for grouping numbers (matches desktop rangeSize=10). */
    static final int RANGE_SIZE = 10;

    /**
     * Builds the frequency rollup list - one entry per number in the lottery field.
     *
     * @param allPatterns the complete draw history (oldest to newest); may be {@code null}
     * @return sorted list by number ascending; {@code List.of()} if input is null/empty
     */
    public List<NumberFrequencyViewModel> buildFrequencyRollups(List<DrawResultPattern> allPatterns) {
        if (allPatterns == null || allPatterns.isEmpty()) {
            return List.of();
        }

        // Use the most recent draw to determine the current GO per number and field range
        DrawResultPattern latestPattern = allPatterns.get(allPatterns.size() - 1);
        List<LotteryNumber> latestNumbers = latestPattern.lotteryNumbers();
        if (latestNumbers == null || latestNumbers.isEmpty()) {
            return List.of();
        }

        // Build a set of all numbers in the field
        List<Integer> fieldNumbers = latestNumbers.stream()
                .map(LotteryNumber::number)
                .sorted()
                .toList();

        // Pre-compute: for each number, collect its GO sequence over all draws
        // goHistory.get(number) = list of GO values, one per draw (oldest first)
        Map<Integer, List<Integer>> goHistory = new HashMap<>();
        for (int num : fieldNumbers) {
            goHistory.put(num, new ArrayList<>(allPatterns.size()));
        }
        for (DrawResultPattern pattern : allPatterns) {
            if (pattern.lotteryNumbers() == null) continue;
            for (LotteryNumber ln : pattern.lotteryNumbers()) {
                List<Integer> hist = goHistory.get(ln.number());
                if (hist != null) {
                    hist.add(ln.gamesOut());
                }
            }
        }

        // Build NumberFrequencyViewModel per number
        List<NumberFrequencyViewModel> result = new ArrayList<>(fieldNumbers.size());
        for (LotteryNumber ln : latestNumbers) {
            int number = ln.number();
            int currentGO = ln.gamesOut();
            String zone = classifyZone(currentGO);
            List<Integer> history = goHistory.getOrDefault(number, List.of());

            int total = history.size();
            long exactMatchCount = history.stream().filter(go -> go == currentGO).count();
            double frequencyPercent = total > 0 ? (double) exactMatchCount / total * 100.0 : 0.0;

            // rangeFrequency: count draws where GO was currentGO (in this number's range)
            // and the NEXT draw had GO==0 (a hit) - mirrors calculateGOValueStats.
            int[] rangeFreqAndDrawsAgo = computeRangeFreqAndDrawsAgo(history, currentGO);

            result.add(new NumberFrequencyViewModel(
                    number,
                    currentGO,
                    zone,
                    frequencyPercent,
                    rangeFreqAndDrawsAgo[0],
                    rangeFreqAndDrawsAgo[1]
            ));
        }

        result.sort(Comparator.comparingInt(NumberFrequencyViewModel::number));
        return List.copyOf(result);
    }

    /**
     * Builds range rollups from the frequency rollup list (one per range-of-10).
     *
     * @param rollups the output of {@link #buildFrequencyRollups}; must not be {@code null}
     * @return list of range summaries; {@code List.of()} if input is null/empty
     */
    public List<RangeRollupViewModel> buildRangeRollups(List<NumberFrequencyViewModel> rollups) {
        Objects.requireNonNull(rollups, "rollups must not be null");
        if (rollups.isEmpty()) {
            return List.of();
        }

        // Group numbers into ranges of 10
        Map<Integer, List<NumberFrequencyViewModel>> byRange = new HashMap<>();
        for (NumberFrequencyViewModel nfv : rollups) {
            int rangeKey = ((nfv.number() - 1) / RANGE_SIZE) * RANGE_SIZE + 1; // e.g. 1,11,21,31
            byRange.computeIfAbsent(rangeKey, k -> new ArrayList<>()).add(nfv);
        }

        List<RangeRollupViewModel> rangeRollups = new ArrayList<>(byRange.size());
        for (Map.Entry<Integer, List<NumberFrequencyViewModel>> entry : byRange.entrySet()) {
            int rangeStart = entry.getKey();
            int rangeEnd = rangeStart + RANGE_SIZE - 1;
            long hot  = entry.getValue().stream().filter(n -> "HOT".equals(n.zone())).count();
            long warm = entry.getValue().stream().filter(n -> "WARM".equals(n.zone())).count();
            long cold = entry.getValue().stream().filter(n -> "COLD".equals(n.zone())).count();
            rangeRollups.add(new RangeRollupViewModel(rangeStart, rangeEnd, (int) hot, (int) warm, (int) cold));
        }

        rangeRollups.sort(Comparator.comparingInt(RangeRollupViewModel::rangeStart));
        return List.copyOf(rangeRollups);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Classifies a games-out value into HOT / WARM / COLD zone.
     * HOT: 0–9, WARM: 10–19, COLD: 20+.
     */
    static String classifyZone(int gamesOut) {
        if (gamesOut <= 9)  return "HOT";
        if (gamesOut <= 19) return "WARM";
        return "COLD";
    }

    /**
     * Computes range frequency (how many times this GO value transitioned to a hit
     * in the NEXT draw) and draws-ago (draws since the last such transition).
     *
     * @param history    GO values for one number, oldest-to-newest
     * @param targetGO   the current GO value to look up
     * @return int[2] - [0] = rangeFrequency, [1] = drawsAgo (0 if never)
     */
    private int[] computeRangeFreqAndDrawsAgo(List<Integer> history, int targetGO) {
        if (history.size() < 2) {
            return new int[]{0, 0};
        }
        int freq = 0;
        int lastHitIdx = -1;
        for (int i = 0; i < history.size() - 1; i++) {
            if (history.get(i) == targetGO && history.get(i + 1) == 0) {
                freq++;
                lastHitIdx = i;
            }
        }
        int drawsAgo = lastHitIdx < 0 ? 0 : (history.size() - 1 - lastHitIdx);
        return new int[]{freq, drawsAgo};
    }
}
