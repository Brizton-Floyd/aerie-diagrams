package com.floyd.lottoptions.core.domain.draw;

import com.floyd.lottoptions.core.domain.game.GameId;

/**
 * Thrown when the draw-history source has no such game in the state. The Core API answers 404
 * for it.
 */
public final class UnknownGameException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /**
     * @param game  the requested game
     * @param cause the source's own failure
     */
    public UnknownGameException(GameId game, Throwable cause) {
        super("No game '" + game.game() + "' in state '" + game.state() + "'", cause);
    }
}
