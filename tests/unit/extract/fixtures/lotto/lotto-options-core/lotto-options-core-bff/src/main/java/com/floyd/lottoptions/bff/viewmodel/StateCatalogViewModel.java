package com.floyd.lottoptions.bff.viewmodel;

import java.util.List;

/**
 * Top-level response for {@code GET /ui/catalog/states} (FR-008-D, FR-008-G).
 *
 * <p>Carries the full States-to-Games catalog for the Angular
 * {@code StateGamePickerComponent}. States are alphabetically ordered as
 * returned by the persistence service endpoint
 * {@code GET /api/v1/all/v2/state-games}.</p>
 *
 * <p>Java Record - inherently immutable (Effective Java Item 17). No Lombok.</p>
 *
 * @param states the ordered list of state entries; never {@code null}
 */
public record StateCatalogViewModel(List<StateEntryViewModel> states) {}
