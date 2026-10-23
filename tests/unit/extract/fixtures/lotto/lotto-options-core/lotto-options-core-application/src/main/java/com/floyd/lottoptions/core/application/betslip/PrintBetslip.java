package com.floyd.lottoptions.core.application.betslip;

import com.floyd.lottoptions.core.domain.betslip.BetslipOrder;
import com.floyd.lottoptions.core.domain.betslip.BetslipRenderer;

import java.util.Objects;

/**
 * Use case: print a betslip order, the player's plays marked on the game's slips.
 */
public final class PrintBetslip {

    private final BetslipRenderer renderer;

    /**
     * @param renderer what prints the slips
     */
    public PrintBetslip(BetslipRenderer renderer) {
        this.renderer = Objects.requireNonNull(renderer, "renderer");
    }

    /**
     * Prints the order.
     *
     * @param order what to print
     * @return the printable document's bytes
     * @throws com.floyd.lottoptions.core.domain.betslip.BetslipTemplateNotFoundException when
     *         there is no slip for the order's game
     * @throws com.floyd.lottoptions.core.domain.betslip.UnknownGlobalOptionException when the
     *         slip has no global option by the requested name
     */
    public byte[] print(BetslipOrder order) {
        return renderer.render(Objects.requireNonNull(order, "order"));
    }
}
