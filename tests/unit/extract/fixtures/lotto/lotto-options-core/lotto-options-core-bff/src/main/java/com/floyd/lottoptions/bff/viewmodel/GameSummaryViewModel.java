package com.floyd.lottoptions.bff.viewmodel;

/**
 * Summary of a single lottery game in the state-game catalog (FR-008-D, FR-018-D).
 *
 * <p>Used by {@code StateGamePickerComponent} in Angular to populate the games
 * column of the cascading picker. Intentionally excludes draw history.</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param gameName  the display name of the game (e.g. "Cash Five")
 * @param minNumber the minimum ball number in the field
 * @param maxNumber the maximum ball number in the field
 * @param pickCount the number of balls drawn per play (e.g. 5 for Cash Five, 6 for Lotto Texas);
 *                  enables the Angular position-toggle renderer to know how many toggles to show
 *                  without hardcoding per-game knowledge (FR-018-D)
 */
public record GameSummaryViewModel(String gameName, int minNumber, int maxNumber, int pickCount) {}
