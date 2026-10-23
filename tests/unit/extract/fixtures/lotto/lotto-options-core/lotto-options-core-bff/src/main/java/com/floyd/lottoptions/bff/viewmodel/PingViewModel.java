package com.floyd.lottoptions.bff.viewmodel;

/**
 * View model returned by {@code GET /ui/ping}.
 *
 * <p>Establishes the per-screen view-model pattern for the BFF:
 * <ul>
 *   <li>Immutable Java Record - no setters, no Lombok required (Effective Java Item 17).</li>
 *   <li>Named {@code <ScreenName>ViewModel}.</li>
 *   <li>Contains only the fields the screen renders.</li>
 *   <li>Serialized as a JSON object - never a bare string, array, or primitive.</li>
 * </ul>
 *
 * <p>Jackson serializes this record to:
 * {@code {"status":"ok","message":"BFF is alive"}}</p>
 *
 * @param status  a fixed value ({@code "ok"}) confirming the BFF is reachable
 * @param message a human-readable string ({@code "BFF is alive"})
 */
public record PingViewModel(String status, String message) {
}
