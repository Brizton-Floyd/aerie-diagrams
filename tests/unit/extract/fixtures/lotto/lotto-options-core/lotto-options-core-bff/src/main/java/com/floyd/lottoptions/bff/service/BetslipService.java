package com.floyd.lottoptions.bff.service;

import com.floyd.lottoptions.bff.client.CoreApiClient;
import com.floyd.lottoptions.bff.controller.dto.BetslipPdfRequest;
import com.floyd.lottoptions.core.contract.betslip.BetslipPdfRequest.ColorMode;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import tools.jackson.databind.json.JsonMapper;

import java.util.Collections;

/**
 * BFF orchestration service for betslip PDF generation (FR-014-007).
 *
 * <p>Merges path variables ({@code state}, {@code game}) from the BFF controller
 * into the Core API's betslip request and delegates to
 * {@link CoreApiClient#generateBetslipPdf}. No {@code block()}
 * calls; the reactive chain is preserved end-to-end.</p>
 *
 * <p>Constructor injection only (Effective Java Item 5). No field {@code @Autowired}.
 * The class is {@code final} - not designed for extension (Effective Java Item 17).</p>
 */
@Service
public final class BetslipService {

    private final CoreApiClient coreApiClient;
    private final JsonMapper jsonMapper;

    /**
     * @param coreApiClient the Core API client
     * @param jsonMapper    the Boot-managed mapper, which reads the color mode
     */
    public BetslipService(CoreApiClient coreApiClient, JsonMapper jsonMapper) {
        this.coreApiClient = coreApiClient;
        this.jsonMapper = jsonMapper;
    }

    /**
     * Generates a betslip PDF by forwarding the request (with merged state/game)
     * to the Core API.
     *
     * @param state   the lottery state from the URL path (e.g. {@code "Texas"})
     * @param game    the lottery game from the URL path (e.g. {@code "Cash Five"})
     * @param request the BFF-level betslip PDF request body
     * @return a {@link Mono} emitting the raw PDF bytes from the Core API
     */
    public Mono<byte[]> generateBetslipPdf(String state, String game, BetslipPdfRequest request) {
        var coreRequest = new com.floyd.lottoptions.core.contract.betslip.BetslipPdfRequest(
                state,
                game,
                request.getNumberSets(),
                request.getBonusNumbers() != null ? request.getBonusNumbers() : Collections.emptyList(),
                request.getGlobalOption(),
                colorMode(request.getColorMode()));
        return coreApiClient.generateBetslipPdf(coreRequest);
    }

    /**
     * The BFF takes the color mode as text and Core as a {@link ColorMode}. The text is read with
     * the same Jackson rules Core used to read it when the BFF forwarded it as text (a name, with
     * blanks around it ignored, or an index), so every value Core printed before still prints
     * the same; any other value fails here instead of in Core. No value means {@code COLOR}.
     */
    private ColorMode colorMode(String colorMode) {
        return colorMode != null ? jsonMapper.convertValue(colorMode, ColorMode.class) : ColorMode.COLOR;
    }
}
