package com.floyd.lottoptions.bff.client;

/**
 * Thrown when the Core API answers 404, such as for a game it does not know. The BFF answers
 * 404 for it.
 */
public final class CoreNotFoundException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /**
     * @param detail what was not found: Core's problem detail, or a fallback when Core sent none
     */
    public CoreNotFoundException(String detail) {
        super(detail);
    }
}
