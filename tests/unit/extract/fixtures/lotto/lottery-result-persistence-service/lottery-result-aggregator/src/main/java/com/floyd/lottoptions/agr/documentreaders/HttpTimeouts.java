package com.floyd.lottoptions.agr.documentreaders;

/**
 * Shared connect/read timeouts for outbound lottery-source downloads. Without these a
 * slow or hung endpoint would block a polling thread indefinitely.
 */
final class HttpTimeouts {

    static final int CONNECT_TIMEOUT_MS = 10_000;
    static final int READ_TIMEOUT_MS = 30_000;

    private HttpTimeouts() {
    }
}
