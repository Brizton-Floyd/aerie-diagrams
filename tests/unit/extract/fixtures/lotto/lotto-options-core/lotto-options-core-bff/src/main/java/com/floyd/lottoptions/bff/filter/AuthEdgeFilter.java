package com.floyd.lottoptions.bff.filter;

import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;

import reactor.core.publisher.Mono;

/**
 * Security edge filter - present but no-op today.
 *
 * <p>All authentication logic must be added here. Enabling auth requires
 * changing this implementation only; no controllers are touched.</p>
 *
 * <p>The filter is declared {@code final} (Effective Java Items 17 and 19:
 * prohibit subclassing unless the class is explicitly designed for extension).
 * Future auth behaviour is introduced by replacing the bean, not by
 * subclassing. This keeps the security seam clean and controllable.</p>
 *
 * <p>Today the filter unconditionally delegates to {@code chain.filter(exchange)},
 * allowing all requests through without inspection.</p>
 */
@Component
public final class AuthEdgeFilter implements WebFilter {

    /**
     * Passes every request through unconditionally.
     *
     * <p>No-op today. When authentication is introduced, this method will
     * inspect the request, validate credentials, and either call
     * {@code chain.filter(exchange)} to continue or short-circuit with an
     * appropriate 401/403 response.</p>
     *
     * @param exchange the current server web exchange
     * @param chain    the filter chain
     * @return a {@link Mono} that completes when the downstream chain finishes
     */
    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        // No-op today. Authentication logic goes here when enabled.
        return chain.filter(exchange);
    }
}
