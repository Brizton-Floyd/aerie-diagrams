package com.floyd.lottoptions.bff.viewmodel;

import java.util.List;

/**
 * A single state entry in the catalog, with its games list (FR-008-D).
 *
 * <p>Used by {@code StateGamePickerComponent} in Angular for the state column
 * of the cascading picker.</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param stateName the display name of the state (e.g. "Texas")
 * @param games     the games available in this state; never {@code null}
 */
public record StateEntryViewModel(String stateName, List<GameSummaryViewModel> games) {}
