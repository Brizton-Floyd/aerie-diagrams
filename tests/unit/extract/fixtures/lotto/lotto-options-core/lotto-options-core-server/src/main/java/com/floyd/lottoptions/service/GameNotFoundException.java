package com.floyd.lottoptions.service;

/**
 * Thrown when the results service has no draw history for a game in a state, because no
 * such game exists there. The live Core API answers 404 for it.
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
