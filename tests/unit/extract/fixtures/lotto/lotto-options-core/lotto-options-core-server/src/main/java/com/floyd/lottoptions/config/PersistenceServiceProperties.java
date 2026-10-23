package com.floyd.lottoptions.config;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Externalized configuration for the results service
 * ({@code lottery-result-persistence-service}), the one place Core reads its URL from.
 *
 * <p>Bound to the {@code persistence-service} prefix in {@code application.yaml} and
 * validated at startup, so Core fails fast with a clear message when the host is
 * missing or blank instead of failing on its first request (Effective Java Item 49).</p>
 *
 * <p>The defaults live in {@code application.yaml}; the host is the only results-service
 * URL setting Core has.</p>
 *
 * @param host  base URL of the results service; a trailing slash is optional
 * @param games path of the draw-history endpoint, relative to {@code host}
 */
@Validated
@ConfigurationProperties(prefix = "persistence-service")
public record PersistenceServiceProperties(

        @NotBlank(message = "persistence-service.host must not be blank")
        String host,

        @NotBlank(message = "persistence-service.games must not be blank")
        String games
) {

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
