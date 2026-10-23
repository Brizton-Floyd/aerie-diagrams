package com.floyd.lottoptions.legacy.desktop.shared.service;

import org.springframework.web.util.UriComponentsBuilder;

import java.util.Objects;

/**
 * Where the results service is: legacy's copy of the URL rules of Core's
 * {@code PersistenceServiceProperties}, read from the same {@code persistence-service} keys.
 * Core validates those keys at startup, so this record only joins them.
 *
 * @param host  base URL of the results service; a trailing slash is optional
 * @param games path of the draw-history endpoint, relative to {@code host}
 */
public record ResultsServiceLocation(String host, String games) {

    public ResultsServiceLocation {
        Objects.requireNonNull(host, "host");
        Objects.requireNonNull(games, "games");
    }

    /**
     * Joins {@link #host()} and {@code path} with exactly one slash between them, whether
     * or not the host ends with a slash or the path starts with one. URI template
     * variables such as {@code {state}} are left unexpanded for the caller.
     *
     * @param path path relative to the host; may be empty
     * @return the URL, or URI template, of {@code path} on the results service
     */
    public String url(String path) {
        return UriComponentsBuilder.fromUriString(host)
                .path("/")
                .path(path)
                .build()
                .toUriString();
    }

    /**
     * Returns the URL of the draw-history endpoint ({@link #games()}).
     *
     * @return the draw-history URL
     */
    public String drawHistoryUrl() {
        return url(games);
    }
}
