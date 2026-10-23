package com.floyd.lottoptions.core.server.adapter.web;

import com.floyd.lottoptions.core.application.dashboard.Dashboard;
import com.floyd.lottoptions.core.application.dashboard.LoadDashboard;
import com.floyd.lottoptions.core.contract.dashboard.DashboardResponse;
import com.floyd.lottoptions.core.contract.dashboard.DrawResultPattern;
import com.floyd.lottoptions.core.contract.dashboard.LotteryNumber;
import com.floyd.lottoptions.core.contract.dashboard.PatternAnalysisResult;
import com.floyd.lottoptions.core.domain.game.GameId;
import com.floyd.lottoptions.core.domain.gamesout.DrawGamesOut;
import com.floyd.lottoptions.core.domain.gamesout.NumberGamesOut;
import com.floyd.lottoptions.core.domain.pattern.PatternStatistics;
import com.floyd.lottoptions.core.domain.rules.GameRules;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Core API endpoint for a game's dashboard: its games out after every draw and its odd/even and
 * high/low patterns, over the full draw history.
 *
 * <p>A missing game answers 404 and a down or failing results service 503, through
 * {@code com.floyd.lottoptions.controller.LiveApiExceptionHandler}.</p>
 */
@RestController
@RequestMapping("/api/v1/analysis")
public class DashboardController {

    /** The history's dates on the wire, for example {@code April 29, 2002}. */
    private static final DateTimeFormatter HISTORY_DATE = DateTimeFormatter.ofPattern("MMMM d, yyyy");

    private final LoadDashboard loadDashboard;

    /**
     * @param loadDashboard the use case that loads a dashboard
     */
    public DashboardController(LoadDashboard loadDashboard) {
        this.loadDashboard = loadDashboard;
    }

    /**
     * Returns a game's dashboard.
     *
     * @param lotteryState the state's name (for example {@code Texas})
     * @param lotteryGame  the game's full name (for example {@code Cash Five})
     * @return 200 with the dashboard; 404 without a body when the results service answered
     *         without the game or the game has no draws
     */
    @GetMapping("/{lotteryState}/{lotteryGame}/dashboard")
    public ResponseEntity<DashboardResponse> getDashboardData(@PathVariable String lotteryState,
                                                              @PathVariable String lotteryGame) {
        return loadDashboard.load(new GameId(lotteryState, lotteryGame))
                .map(dashboard -> ResponseEntity.ok(toResponse(dashboard)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private static DashboardResponse toResponse(Dashboard dashboard) {
        return new DashboardResponse(
                dashboard.gamesOut().stream().map(DashboardController::toPattern).toList(),
                byPattern(dashboard.oddEvenPatterns()),
                byPattern(dashboard.highLowPatterns()),
                List.of(HISTORY_DATE.format(dashboard.firstDrawDate()), HISTORY_DATE.format(dashboard.lastDrawDate())),
                GameRules.formatOf(dashboard.game()),
                dashboard.totalDraws());
    }

    private static DrawResultPattern toPattern(DrawGamesOut draw) {
        return new DrawResultPattern(draw.drawDate().toString(),
                draw.numbers().stream().map(DashboardController::toNumber).toList());
    }

    private static LotteryNumber toNumber(NumberGamesOut number) {
        return new LotteryNumber(number.number(), number.gamesOut());
    }

    /** The patterns keyed by name, in the given order. */
    private static Map<String, PatternAnalysisResult> byPattern(List<PatternStatistics> patterns) {
        Map<String, PatternAnalysisResult> byPattern = new LinkedHashMap<>();
        for (PatternStatistics pattern : patterns) {
            byPattern.put(pattern.pattern(), new PatternAnalysisResult(pattern.pattern(), pattern.frequency(),
                    pattern.probability(), pattern.estimatedHitFrequency(), pattern.gamesSinceLastAppearance()));
        }
        return byPattern;
    }
}
