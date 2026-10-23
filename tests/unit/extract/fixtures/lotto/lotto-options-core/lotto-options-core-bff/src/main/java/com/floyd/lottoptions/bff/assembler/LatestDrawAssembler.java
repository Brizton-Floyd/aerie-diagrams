package com.floyd.lottoptions.bff.assembler;

import com.floyd.lottoptions.bff.viewmodel.DrawnBallViewModel;
import com.floyd.lottoptions.bff.viewmodel.LatestDrawViewModel;
import com.floyd.lottoptions.core.contract.dashboard.DrawResultPattern;
import com.floyd.lottoptions.core.contract.dashboard.LotteryNumber;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Pure assembler that extracts the latest draw's ball results from the full draw
 * history list (FR-008-I, ADR-0003).
 *
 * <p>The {@code lotteryNumbers} list in each {@link DrawResultPattern} contains ALL
 * field numbers (e.g. 1–35 for Cash Five). The drawn numbers for a given draw are
 * those where {@code gamesOut == 0}. Their order of appearance in the column-sorted
 * list determines 1-based ball position - ball position 1 maps to the first
 * {@code gamesOut == 0} entry, position 2 to the second, and so on.</p>
 *
 * <p>This class is {@code final} (Effective Java Items 17, 19). No I/O, no reactive
 * types. Constructor injection is not required - no dependencies.</p>
 */
@Component
public final class LatestDrawAssembler {

    /**
     * Builds a {@link LatestDrawViewModel} from the most recent entry in the patterns
     * list, or returns {@link Optional#empty()} when no data is available.
     *
     * <p>Extraction logic:</p>
     * <ol>
     *   <li>Take {@code patterns.get(patterns.size() - 1)} as the latest draw.</li>
     *   <li>Iterate the {@code lotteryNumbers} list in column order.</li>
     *   <li>For each {@link LotteryNumber} where {@code gamesOut == 0}, record
     *       {@code (position, number)} with position incrementing from 1.</li>
     * </ol>
     *
     * @param patterns the complete draw history (oldest to newest); may be {@code null}
     *                 or empty
     * @return {@link Optional} containing the latest draw view model; empty if the
     *         patterns list is null/empty or the latest pattern has no lottery numbers
     */
    public Optional<LatestDrawViewModel> buildLatestDraw(List<DrawResultPattern> patterns) {
        if (patterns == null || patterns.isEmpty()) {
            return Optional.empty();
        }

        DrawResultPattern latest = patterns.get(patterns.size() - 1);
        if (latest.lotteryNumbers() == null) {
            return Optional.empty();
        }

        List<DrawnBallViewModel> balls = new ArrayList<>();
        int position = 1;
        for (LotteryNumber ln : latest.lotteryNumbers()) {
            if (ln.gamesOut() == 0) {
                balls.add(new DrawnBallViewModel(position, ln.number()));
                position++;
            }
        }

        return Optional.of(new LatestDrawViewModel(latest.drawDate(), List.copyOf(balls)));
    }
}
