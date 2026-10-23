package com.floyd.lottoptions.legacy.desktop.shared.service;

/**
 * Thrown when the results service has no draw history for a game in a state, because no
 * such game exists there. Legacy's fork of Core's exception of the same name; no exception
 * handler maps it, so the quarantined endpoints keep their own error behavior.
 */
public final class GameNotFoundException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /**
     * @param game  the requested game name
     * @param state the requested state
     * @param cause the results service's 404
     */
    public GameNotFoundException(String game, String state, Throwable cause) {
        super("No game '" + game + "' in state '" + state + "'", cause);
    }
}
