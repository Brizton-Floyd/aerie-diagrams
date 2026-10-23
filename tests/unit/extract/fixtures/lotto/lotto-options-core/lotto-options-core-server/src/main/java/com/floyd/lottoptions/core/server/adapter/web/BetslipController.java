package com.floyd.lottoptions.core.server.adapter.web;

import com.floyd.lottoptions.core.application.betslip.PrintBetslip;
import com.floyd.lottoptions.core.contract.betslip.BetslipPdfRequest;
import com.floyd.lottoptions.core.domain.betslip.BetslipColorMode;
import com.floyd.lottoptions.core.domain.betslip.BetslipOrder;
import com.floyd.lottoptions.core.domain.betslip.BetslipPlay;
import com.floyd.lottoptions.core.domain.betslip.BetslipTemplateNotFoundException;
import com.floyd.lottoptions.core.domain.betslip.UnknownGlobalOptionException;
import com.floyd.lottoptions.core.domain.game.GameId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;

/**
 * Core API endpoint for betslip PDFs (FR-014-005).
 *
 * <p>{@code POST /api/v1/betslip/pdf} takes a {@link BetslipPdfRequest} and returns
 * {@code application/pdf} bytes. The rendering (AWT and PDFBox) runs on
 * {@link Schedulers#boundedElastic()}.</p>
 *
 * <p>Error mapping:</p>
 * <ul>
 *   <li>no {@code numberSets}, or an empty list: 400</li>
 *   <li>no slip for the state and game: 404, without a body</li>
 *   <li>a global option the slip does not have: 422, without a body</li>
 *   <li>any other failure, including a request without a game: 500, without a body (the cause
 *       is logged)</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1")
public class BetslipController {

    private static final Logger log = LoggerFactory.getLogger(BetslipController.class);

    private final PrintBetslip printBetslip;

    /**
     * @param printBetslip the use case that prints the slips
     */
    public BetslipController(PrintBetslip printBetslip) {
        this.printBetslip = printBetslip;
    }

    /**
     * Prints the request's plays on the game's betslips.
     *
     * @param request the plays and how to print them
     * @return 200 with the PDF as an attachment named {@code betslips.pdf}
     */
    @PostMapping(value = "/betslip/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public Mono<ResponseEntity<byte[]>> generateBetslipPdf(@RequestBody BetslipPdfRequest request) {
        if (request.numberSets() == null || request.numberSets().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "numberSets must not be empty");
        }
        return Mono.fromCallable(() -> printBetslip.print(toOrder(request)))
                .subscribeOn(Schedulers.boundedElastic())
                .map(pdfBytes -> {
                    HttpHeaders headers = new HttpHeaders();
                    headers.setContentType(MediaType.APPLICATION_PDF);
                    headers.setContentDisposition(
                            ContentDisposition.attachment().filename("betslips.pdf").build());
                    return ResponseEntity.ok()
                            .headers(headers)
                            .body(pdfBytes);
                })
                .onErrorResume(BetslipTemplateNotFoundException.class, ex -> {
                    log.warn("Template not found: {}", ex.getMessage());
                    return Mono.just(ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .<byte[]>build());
                })
                .onErrorResume(UnknownGlobalOptionException.class, ex -> {
                    log.warn("Invalid global option: {}", ex.getMessage());
                    return Mono.just(ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                            .<byte[]>build());
                })
                .onErrorResume(Exception.class, ex -> {
                    log.error("PDF generation failed", ex);
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .<byte[]>build());
                });
    }

    /**
     * Maps the request to the domain. An absent {@code bonusNumbers} marks no bonus and an
     * absent {@code colorMode} prints in color.
     */
    private static BetslipOrder toOrder(BetslipPdfRequest request) {
        List<Integer> bonusNumbers = request.bonusNumbers() == null ? List.of() : request.bonusNumbers();
        List<BetslipPlay> plays = new ArrayList<>(request.numberSets().size());
        for (int play = 0; play < request.numberSets().size(); play++) {
            Integer bonus = play < bonusNumbers.size() ? bonusNumbers.get(play) : null;
            plays.add(new BetslipPlay(Arrays.stream(request.numberSets().get(play)).boxed().toList(),
                    bonus == null ? OptionalInt.empty() : OptionalInt.of(bonus)));
        }
        return new BetslipOrder(gameId(request), plays, Optional.ofNullable(request.globalOption()),
                colorMode(request.colorMode()));
    }

    private static BetslipColorMode colorMode(BetslipPdfRequest.ColorMode colorMode) {
        if (colorMode == null) {
            return BetslipColorMode.COLOR;
        }
        return switch (colorMode) {
            case COLOR -> BetslipColorMode.COLOR;
            case BLACK_AND_WHITE -> BetslipColorMode.BLACK_AND_WHITE;
            case SCANNER_READY -> BetslipColorMode.SCANNER_READY;
        };
    }

    /**
     * The requested game. Kept from before the renderer port: a request with a game but no
     * state names no slip, so it answers 404; one without a game fails with 500.
     */
    private static GameId gameId(BetslipPdfRequest request) {
        if (request.state() == null && request.game() != null) {
            throw new BetslipTemplateNotFoundException(null, request.game());
        }
        return new GameId(request.state(), request.game());
    }
}
