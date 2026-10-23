package com.floyd.lottoptions.bff.assembler;

import com.floyd.lottoptions.bff.viewmodel.MatrixCellViewModel;
import com.floyd.lottoptions.bff.viewmodel.MatrixPageViewModel;
import com.floyd.lottoptions.bff.viewmodel.MatrixRowViewModel;
import com.floyd.lottoptions.core.contract.draws.DrawPage;
import com.floyd.lottoptions.core.contract.draws.DrawRow;
import com.floyd.lottoptions.core.contract.draws.DrawRowNumber;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Pure assembler that produces a paged draw-history matrix window from one page of Core's draw
 * history.
 *
 * <p>Mirrors the desktop's {@code numberColumnsTable} + {@code dateColumnTable} data
 * (DashBoardController.java:179–350) with server-side paging to avoid shipping the
 * full 7.6 MB history to the browser (FR-006-D, ADR-0003). Core picks the page and supplies the
 * game rules (S33); this class keeps the screen's shaping.</p>
 *
 * <h3>Paging protocol</h3>
 * <ul>
 *   <li>Core resolves the page: {@code draws[startIndex .. endIndex)} of the oldest-first history,
 *       {@code endIndex} capped at {@code totalDraws}.</li>
 *   <li>The page's rows are delivered newest first.</li>
 *   <li>{@code hasOlder} = startIndex > 0.</li>
 *   <li>{@code hasNewer} = endIndex < totalDraws.</li>
 * </ul>
 *
 * <h3>Position derivation</h3>
 * Within each draw, numbers with {@code gamesOut == 0} are assigned 1-based position
 * in their list order (mirrors DashBoardController.java:207–229). Non-hit cells carry
 * {@code position = null}.
 *
 * <p>This class is {@code final} (Effective Java Items 17, 19). No I/O, no reactive types.</p>
 */
@Component
public final class MatrixPageAssembler {

    /** Default page size (50 rows). */
    public static final int DEFAULT_PAGE_SIZE = 50;

    /** Maximum page size (100 rows). */
    public static final int MAX_PAGE_SIZE = 100;

    /**
     * Builds a paged matrix window.
     *
     * @param page one page of the draw history with the game's rules; must not be {@code null}
     * @return the paged matrix; an empty page when the history has no draws
     */
    public MatrixPageViewModel buildMatrixPage(DrawPage page) {
        Objects.requireNonNull(page, "page must not be null");

        int total = page.totalDraws();
        if (total == 0) {
            return emptyPage(0, 1, 1, 0);
        }

        int fieldMin = page.rules().fieldMin();
        int fieldMax = page.rules().fieldMax();

        // Reverse for newest-first delivery
        List<DrawRow> slice = new ArrayList<>(page.draws());
        Collections.reverse(slice);

        boolean hasOlder = page.startIndex() > 0;
        boolean hasNewer = page.endIndex() < total;

        List<MatrixRowViewModel> rows = new ArrayList<>(slice.size());
        for (DrawRow draw : slice) {
            rows.add(buildRow(draw, fieldMin, fieldMax));
        }

        return new MatrixPageViewModel(
                total,
                fieldMin,
                fieldMax,
                rows.size(),
                page.endIndex(),
                hasOlder,
                hasNewer,
                List.copyOf(rows)
        );
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private MatrixRowViewModel buildRow(DrawRow draw, int fieldMin, int fieldMax) {
        List<DrawRowNumber> numbers = draw.numbers();
        if (numbers == null || numbers.isEmpty()) {
            return new MatrixRowViewModel(draw.drawDate(), List.of());
        }

        // Assign positions: collect hit numbers (GO==0) in list order, assign 1-based position
        Map<Integer, Integer> positionMap = new HashMap<>();
        int posCounter = 1;
        for (DrawRowNumber number : numbers) {
            if (number.gamesOut() == 0) {
                positionMap.put(number.number(), posCounter++);
            }
        }

        // Build a lookup: number → its games out for efficient cell building
        Map<Integer, DrawRowNumber> goByNumber = new HashMap<>();
        for (DrawRowNumber number : numbers) {
            goByNumber.put(number.number(), number);
        }

        // Build one cell per number in field
        List<MatrixCellViewModel> cells = new ArrayList<>(fieldMax - fieldMin + 1);
        for (int num = fieldMin; num <= fieldMax; num++) {
            DrawRowNumber number = goByNumber.get(num);
            if (number == null) {
                cells.add(new MatrixCellViewModel(num, 0, null));
            } else {
                Integer position = positionMap.get(num); // null if not hit
                cells.add(new MatrixCellViewModel(num, number.gamesOut(), position));
            }
        }

        return new MatrixRowViewModel(draw.drawDate(), List.copyOf(cells));
    }

    private MatrixPageViewModel emptyPage(int total, int fieldMin, int fieldMax, int endIndex) {
        return new MatrixPageViewModel(total, fieldMin, fieldMax, 0, endIndex, false, false, List.of());
    }
}
