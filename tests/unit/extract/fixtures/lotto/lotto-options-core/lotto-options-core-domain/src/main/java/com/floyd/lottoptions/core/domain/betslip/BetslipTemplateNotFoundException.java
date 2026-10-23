package com.floyd.lottoptions.core.domain.betslip;

/**
 * There is no betslip for the requested game.
 */
public final class BetslipTemplateNotFoundException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /**
     * @param state the requested state's name
     * @param game  the requested game's name
     */
    public BetslipTemplateNotFoundException(String state, String game) {
        super("No betslip template for " + state + " / " + game);
    }
}
