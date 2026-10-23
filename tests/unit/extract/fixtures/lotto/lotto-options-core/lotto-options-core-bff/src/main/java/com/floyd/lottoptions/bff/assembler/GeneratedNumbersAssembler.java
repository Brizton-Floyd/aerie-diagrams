package com.floyd.lottoptions.bff.assembler;

import com.floyd.lottoptions.bff.viewmodel.GeneratedNumbersViewModel;
import com.floyd.lottoptions.bff.viewmodel.PrizeLevelViewModel;
import com.floyd.lottoptions.core.contract.generate.GeneratedNumberData;
import com.floyd.lottoptions.core.contract.generate.PrizeLevelResult;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;

/**
 * Pure assembler that projects a Core {@link GeneratedNumberData} response into a
 * {@link GeneratedNumbersViewModel} consumed by the Angular Smart Generator screen
 * (FR-013-ASSEMBLER, ADR-0003).
 *
 * <p>This assembler's primary semantic contribution is the field rename applied at the
 * BFF projection layer, correcting a historical mislabel in the Core model:</p>
 * <ul>
 *   <li>{@code PrizeLevelResult.expectedElapsedDaysBeforeWin} (a days-based estimate,
 *       historically surfaced as "Expected Games Out") →
 *       {@link PrizeLevelViewModel#estimatedDaysToWin()}</li>
 *   <li>{@code GeneratedNumberData.estimatedElapsedDaysForTargetedPrizeLevelWin} →
 *       {@link GeneratedNumbersViewModel#estimatedDaysToWinTargeted()}</li>
 * </ul>
 *
 * <p>No arithmetic that can produce division by zero: this assembler is a pure
 * field-to-field projection with no computed fields (FR-013 Section 1.2 constraint 10).
 * When {@code data.prizeLevelResults()} is {@code null}, an empty {@link List#of()}
 * is returned for the {@code prizeLevels} field (Effective Java Item 54).</p>
 *
 * <p>This class is {@code final} (Effective Java Items 17, 19). No I/O, no reactive
 * types. Constructor injection is used throughout; no field {@code @Autowired}
 * (Effective Java Item 5).</p>
 */
@Component
public final class GeneratedNumbersAssembler {

    /**
     * Constructs a {@code GeneratedNumbersAssembler}.
     */
    public GeneratedNumbersAssembler() {
        // No collaborators; constructor present to satisfy Effective Java Item 5
        // (explicit public constructor with Javadoc rather than implicit default).
    }

    /**
     * Projects a {@link GeneratedNumberData} from the Core API into a
     * {@link GeneratedNumbersViewModel} for the Angular Smart Generator screen.
     *
     * <p>Field mapping:</p>
     * <ul>
     *   <li>{@code data.generatedNumbers()} → {@code sets}</li>
     *   <li>{@code data.prizeLevelResults()} → {@code prizeLevels}
     *       (mapped per-element; {@code null} guarded to {@code List.of()})</li>
     *   <li>{@code data.totalTickets()} → {@code totalTickets}</li>
     *   <li>{@code data.estimatedElapsedDaysForTargetedPrizeLevelWin()} →
     *       {@code estimatedDaysToWinTargeted}</li>
     * </ul>
     *
     * @param data the Core API response to project; must not be {@code null}
     * @return the assembled {@link GeneratedNumbersViewModel}; never {@code null}
     * @throws NullPointerException if {@code data} is {@code null}
     */
    public GeneratedNumbersViewModel assemble(GeneratedNumberData data) {
        Objects.requireNonNull(data, "data must not be null");

        List<PrizeLevelResult> coreResults = data.prizeLevelResults();
        List<PrizeLevelViewModel> prizeLevels = (coreResults == null)
                ? List.of()
                : coreResults.stream()
                        .map(this::assemblePrizeLevel)
                        .toList();

        return new GeneratedNumbersViewModel(
                data.generatedNumbers(),
                prizeLevels,
                data.totalTickets(),
                data.estimatedElapsedDaysForTargetedPrizeLevelWin());
    }

    /**
     * Projects a single {@link PrizeLevelResult} into a {@link PrizeLevelViewModel}.
     *
     * <p>The Core field {@code expectedElapsedDaysBeforeWin} (a days-based estimate)
     * maps to {@link PrizeLevelViewModel#estimatedDaysToWin()}, correcting the
     * historical "Expected Games Out" mislabel (days ≠ games).</p>
     *
     * @param result the Core prize-level result; must not be {@code null}
     * @return the assembled {@link PrizeLevelViewModel}
     */
    private PrizeLevelViewModel assemblePrizeLevel(PrizeLevelResult result) {
        return new PrizeLevelViewModel(
                result.correctNumbers(),
                result.hits(),
                result.gamesOut(),
                result.expectedElapsedDaysBeforeWin());
    }
}
