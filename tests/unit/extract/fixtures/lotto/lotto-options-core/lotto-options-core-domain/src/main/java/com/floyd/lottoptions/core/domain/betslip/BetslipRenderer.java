package com.floyd.lottoptions.core.domain.betslip;

/**
 * Prints betslips. Core's adapter marks the state's scanned slip images and lays them out in a
 * PDF.
 */
public interface BetslipRenderer {

    /**
     * Renders the order's betslips as a printable document.
     *
     * @param order what to print
     * @return the document's bytes
     * @throws BetslipTemplateNotFoundException when there is no slip for the order's game
     * @throws UnknownGlobalOptionException     when the slip has no global option by the
     *                                          requested name
     */
    byte[] render(BetslipOrder order);
}
