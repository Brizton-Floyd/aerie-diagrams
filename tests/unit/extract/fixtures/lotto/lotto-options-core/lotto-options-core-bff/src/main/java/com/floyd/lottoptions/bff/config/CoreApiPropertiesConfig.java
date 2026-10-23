package com.floyd.lottoptions.bff.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.NotBlank;

/**
 * Externalized configuration for the Core API connection.
 *
 * <p>Bound to the {@code core-api} prefix in {@code application.yaml}.
 * Implemented as a Java Record to guarantee immutability (Effective Java
 * Item 17) and eliminate the need for Lombok on a config holder.
 * Validated at startup so the BFF fails fast with a clear message when
 * the base URL is missing or blank (Effective Java Item 49).</p>
 *
 * <p>Example YAML binding:</p>
 * <pre>{@code
 * core-api:
 *   base-url: http://localhost:8002
 * }</pre>
 */
@Validated
@ConfigurationProperties(prefix = "core-api")
public record CoreApiPropertiesConfig(

        /**
         * Base URL of the Core API service. Must be non-blank.
         * Default: {@code http://localhost:8002} (configured in application.yaml).
         */
        @NotBlank(message = "core-api.base-url must not be blank")
        String baseUrl
) {
}
