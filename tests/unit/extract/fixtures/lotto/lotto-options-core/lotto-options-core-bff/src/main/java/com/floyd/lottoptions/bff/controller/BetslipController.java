package com.floyd.lottoptions.bff.controller;

import com.floyd.lottoptions.bff.controller.dto.BetslipPdfRequest;
import com.floyd.lottoptions.bff.service.BetslipService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

/**
 * BFF endpoint for betslip PDF generation (FR-014-008).
 *
 * <p>Exposes {@code POST /ui/dashboard/{state}/{game}/betslip/pdf}. State and game
 * are taken from the path; the request body carries only the play data. Delegates
 * entirely to {@link BetslipService} - no domain logic here.</p>
 *
 * <p>Constructor injection only (Effective Java Item 5). No {@code block()} in the
 * reactive chain (FR-014 constraint). Mirrors {@link DashboardController} style.</p>
 */
@Tag(name = "Betslip", description = "Betslip PDF generation endpoint (FR-014)")
@RestController
@RequestMapping("/ui")
public class BetslipController {

    private final BetslipService betslipService;

    public BetslipController(BetslipService betslipService) {
        this.betslipService = betslipService;
    }

    /**
     * Generates and returns a print-ready betslip PDF for the given state, game, and plays.
     *
     * @param state   the lottery state (e.g. {@code "Texas"})
     * @param game    the lottery game (e.g. {@code "Cash Five"})
     * @param request betslip play data (number sets, optional bonus numbers, color mode)
     * @return {@code Mono<ResponseEntity<byte[]>>} with {@code Content-Type: application/pdf}
     */
    @Operation(
            summary = "Generate betslip PDF",
            description = "Generates a print-ready, OMR-scannable Texas Lottery betslip PDF. " +
                    "State and game come from the path; play data from the request body. FR-014.")
    @PostMapping(value = "/dashboard/{state}/{game}/betslip/pdf",
            produces = MediaType.APPLICATION_PDF_VALUE)
    public Mono<ResponseEntity<byte[]>> generateBetslipPdf(
            @Parameter(description = "Lottery state, e.g. Texas")
            @PathVariable String state,
            @Parameter(description = "Lottery game name, e.g. Cash Five")
            @PathVariable String game,
            @RequestBody BetslipPdfRequest request) {
        return betslipService.generateBetslipPdf(state, game, request)
                .map(pdfBytes -> {
                    HttpHeaders headers = new HttpHeaders();
                    headers.setContentType(MediaType.APPLICATION_PDF);
                    headers.setContentDisposition(
                            ContentDisposition.attachment().filename("betslips.pdf").build());
                    return ResponseEntity.ok()
                            .headers(headers)
                            .body(pdfBytes);
                });
    }
}
