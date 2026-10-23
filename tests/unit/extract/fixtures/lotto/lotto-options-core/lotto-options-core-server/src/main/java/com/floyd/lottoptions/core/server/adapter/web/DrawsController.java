package com.floyd.lottoptions.core.server.adapter.web;

import com.floyd.lottoptions.core.application.draws.DrawHistoryPage;
import com.floyd.lottoptions.core.application.draws.PageDrawHistory;
import com.floyd.lottoptions.core.contract.draws.DrawPage;
import com.floyd.lottoptions.core.contract.draws.DrawRow;
import com.floyd.lottoptions.core.contract.draws.DrawRowNumber;
import com.floyd.lottoptions.core.contract.game.GameRules;
import com.floyd.lottoptions.core.domain.game.GameId;
import com.floyd.lottoptions.core.domain.gamesout.DrawGamesOut;
import com.floyd.lottoptions.core.domain.gamesout.NumberGamesOut;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.OptionalInt;

/**
 * Core API endpoint for one page of a game's draw history, each draw with the games out after
 * it, and the game's rules.
 *
 * <p>A page out of range answers 400; a missing game answers 404 and a down or failing results
 * service 503, through {@code com.floyd.lottoptions.controller.LiveApiExceptionHandler}.</p>
 */
@RestController
@RequestMapping("/api/v1/analysis")
public class DrawsController {

    /** RFC 9457's type for a problem with no more meaning than its status code. */
    private static final URI ABOUT_BLANK = URI.create("about:blank");

    private final PageDrawHistory pageDrawHistory;

    /**
     * @param pageDrawHistory the use case that reads a page of draw history
     */
    public DrawsController(PageDrawHistory pageDrawHistory) {
        this.pageDrawHistory = pageDrawHistory;
    }

    /**
     * Returns one page of a game's draw history. Indexes count the draws oldest first, from
     * {@code 0}.
     *
     * @param lotteryState the state's name (for example {@code Texas})
     * @param lotteryGame  the game's full name (for example {@code Cash Five})
     * @param endIndex     the index just past the page's latest draw; past the history it means
     *                     the history's end, and left out it means the latest page
     * @param size         the most draws the page holds, 1 to 100
     * @return 200 with the page; 404 without a body when the results service answered without
     *         the game or the game has no draws
     */
    @GetMapping("/{lotteryState}/{lotteryGame}/draws")
    public ResponseEntity<DrawPage> getDraws(@PathVariable String lotteryState,
                                             @PathVariable String lotteryGame,
                                             @RequestParam(required = false) Integer endIndex,
                                             @RequestParam int size) {
        OptionalInt end = endIndex == null ? OptionalInt.empty() : OptionalInt.of(endIndex);
        return pageDrawHistory.page(new GameId(lotteryState, lotteryGame), end, size)
                .map(page -> ResponseEntity.ok(toResponse(page)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /** A page out of range: the use case names the parameter and its value. */
    @ExceptionHandler(IllegalArgumentException.class)
    public ProblemDetail handlePageOutOfRange(IllegalArgumentException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        problem.setType(ABOUT_BLANK);
        return problem;
    }

    private static DrawPage toResponse(DrawHistoryPage page) {
        com.floyd.lottoptions.core.domain.rules.GameRules rules = page.rules();
        return new DrawPage(
                new GameRules(rules.fieldMin(), rules.fieldMax(), rules.pickCount(), rules.format()),
                page.totalDraws(),
                page.startIndex(),
                page.endIndex(),
                page.draws().stream().map(DrawsController::toRow).toList());
    }

    private static DrawRow toRow(DrawGamesOut draw) {
        return new DrawRow(draw.drawDate().toString(),
                draw.numbers().stream().map(DrawsController::toNumber).toList());
    }

    private static DrawRowNumber toNumber(NumberGamesOut number) {
        return new DrawRowNumber(number.number(), number.gamesOut());
    }
}
