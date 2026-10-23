package com.floyd.lottoptions.bff.assembler;

import com.floyd.lottoptions.bff.viewmodel.GameSummaryViewModel;
import com.floyd.lottoptions.bff.viewmodel.StateCatalogViewModel;
import com.floyd.lottoptions.bff.viewmodel.StateEntryViewModel;
import com.floyd.lottoptions.core.contract.catalog.CatalogStatesResponse;
import com.floyd.lottoptions.core.contract.catalog.StateGamesSummary;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;

/**
 * Pure assembler that maps the Core API's {@link CatalogStatesResponse} into the
 * BFF view model {@link StateCatalogViewModel} (FR-008-C, ADR-0003).
 *
 * <p>This class is {@code final} (Effective Java Items 17, 19). No I/O, no reactive
 * types. Constructor injection is not required - no dependencies.</p>
 */
@Component
public final class CatalogAssembler {

    /**
     * Converts a {@link CatalogStatesResponse} from the Core API into a
     * {@link StateCatalogViewModel} for the Angular picker.
     *
     * @param coreResponse the Core API catalog payload; must not be {@code null}
     * @return the view model carrying all states and their game summaries
     * @throws NullPointerException if {@code coreResponse} is {@code null}
     */
    public StateCatalogViewModel assemble(CatalogStatesResponse coreResponse) {
        Objects.requireNonNull(coreResponse, "coreResponse must not be null");

        List<StateEntryViewModel> states = coreResponse.states() == null
                ? List.of()
                : coreResponse.states().stream()
                        .filter(Objects::nonNull)
                        .map(this::toStateEntry)
                        .toList();

        return new StateCatalogViewModel(states);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private StateEntryViewModel toStateEntry(StateGamesSummary entry) {
        List<GameSummaryViewModel> games = entry.games() == null
                ? List.of()
                : entry.games().stream()
                        .filter(Objects::nonNull)
                        .map(g -> new GameSummaryViewModel(g.gameName(), g.minNumber(), g.maxNumber(), g.pickCount()))
                        .toList();
        return new StateEntryViewModel(entry.stateName(), games);
    }
}
