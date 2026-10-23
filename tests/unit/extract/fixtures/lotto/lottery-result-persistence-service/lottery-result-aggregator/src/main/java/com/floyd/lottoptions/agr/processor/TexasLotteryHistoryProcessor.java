package com.floyd.lottoptions.agr.processor;

import com.floyd.lottoptions.agr.config.LotteryUrlConfig;
import com.floyd.lottoptions.agr.documentreaders.FileReader;
import com.floyd.lottoptions.agr.persistence.LotteryGameSerializer;
import com.floyd.persistence.model.LotteryDraw;
import com.floyd.persistence.model.LotteryGame;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Parses the official Texas Lottery CSV exports. Every row starts
 * {@code game, month, day, year}; the columns after that depend on the game's {@link RowLayout}.
 *
 * <p>Each game's file is a complete history, so every poll rebuilds the stored game from scratch
 * and overwrites its {@code .ser}; nothing from a previous poll is merged in. A row that cannot be
 * parsed is rejected (not stored) and counted in the returned {@link GameProcessingResult}.
 */
public class TexasLotteryHistoryProcessor implements HistoryProcessor {
    protected static final Logger log = LoggerFactory.getLogger(TexasLotteryHistoryProcessor.class);
    private static final int MAX_DRAWS = 8000;
    private static final int FIRST_NUMBER_COLUMN = 4;
    /** Rejected rows are logged verbatim up to this many per game; the rest are only counted. */
    private static final int MAX_LOGGED_REJECTIONS = 5;
    private final FileReader fileReader;
    private final LotteryGameSerializer lotteryGameSerializer;

    public TexasLotteryHistoryProcessor(FileReader fileReader, LotteryGameSerializer lotteryGameSerializer) {
        this.fileReader = fileReader;
        this.lotteryGameSerializer = lotteryGameSerializer;
    }

    /** Column layout of a Texas CSV row after the leading {@code game, month, day, year}. */
    enum RowLayout {
        /** Every remaining column is a main number, stored sorted (Lotto Texas, Cash Five, All or Nothing). */
        STANDARD,
        /** Main numbers, then a trailing bonus ball (Texas Two Step). */
        TRAILING_BONUS,
        /**
         * Fixed positions: five white balls ({@code data[4..8]}), the bonus ball ({@code data[9]}), then the
         * multiplier ({@code data[10]}), which may be empty or absent (Powerball, Mega Millions).
         */
        MULTI_STATE,
        /** Digits in drawn order, then two trailing columns ending in the Fireball (Pick 3, Daily 4). */
        FIREBALL;

        static final int MULTI_STATE_WHITE_BALLS = 5;
        static final int MULTI_STATE_BONUS_COLUMN = FIRST_NUMBER_COLUMN + MULTI_STATE_WHITE_BALLS;
        static final int MULTI_STATE_MULTIPLIER_COLUMN = MULTI_STATE_BONUS_COLUMN + 1;

        static RowLayout forGame(String gameName) {
            switch (gameName) {
                case "Lotto Texas":
                case "Cash Five":
                case "All or Nothing Morning":
                case "All or Nothing Day":
                case "All or Nothing Evening":
                case "All or Nothing Night":
                    return STANDARD;
                case "Texas Two Step":
                    return TRAILING_BONUS;
                case "Powerball":
                case "Mega Millions":
                    return MULTI_STATE;
                case "Pick 3 Morning":
                case "Pick 3 Day":
                case "Pick 3 Night":
                case "Pick 3 Evening":
                case "Daily 4 Morning":
                case "Daily 4 Day":
                case "Daily 4 Evening":
                case "Daily 4 Night":
                    return FIREBALL;
                default:
                    throw new IllegalArgumentException("No Texas row layout is defined for game '" + gameName + "'");
            }
        }
    }

    @Override
    public void getHistoricalData(String stateName, List<LotteryUrlConfig.GameInfo> gameInfo) throws Exception{
        log.info("Updating Results Lotto Games for: {}", stateName);
        for (LotteryUrlConfig.GameInfo info : gameInfo) {
            processGame(stateName, info);
        }
    }

    @Override
    public GameProcessingResult processGame(String stateName, LotteryUrlConfig.GameInfo info) throws Exception {
        // Resolve the layout before fetching so an unsupported game fails without a download.
        final RowLayout layout = RowLayout.forGame(info.getName());
        List<String[]> drawResultsInCsvFormat = this.fileReader.getFileContents(info);
        if (drawResultsInCsvFormat.size() > MAX_DRAWS) {
            // Serialize only the most recent MAX_DRAWS results.
            drawResultsInCsvFormat = drawResultsInCsvFormat.subList(drawResultsInCsvFormat.size() - MAX_DRAWS,
                    drawResultsInCsvFormat.size());
        }
        return serializeDrawResults(info.getName(), stateName, drawResultsInCsvFormat, layout);
    }

    private GameProcessingResult serializeDrawResults(String gameName,
                                                      String stateName,
                                                      List<String[]> drawResultsInCsvFormat,
                                                      RowLayout layout) throws IOException {

        log.info("Beginning serialization for " + stateName + ": " + gameName);
        LotteryGame lotteryGame = new LotteryGame();
        lotteryGame.setStateGameBelongsTo(stateName);
        lotteryGame.setFullName(gameName);
        lotteryGame.setLotteryDraws(new ArrayList<>());

        int rejected = 0;
        for (int row = 0; row < drawResultsInCsvFormat.size(); row++) {
            final String[] data = drawResultsInCsvFormat.get(row);
            try {
                lotteryGame.getLotteryDraws().add(parseDraw(data, layout));
            } catch (IllegalArgumentException | DateTimeException e) {
                if (++rejected <= MAX_LOGGED_REJECTIONS) {
                    log.warn("Rejected row {} of {}: {}: {} - {}", row + 1, drawResultsInCsvFormat.size(),
                            stateName + ": " + gameName, Arrays.toString(data), e.getMessage());
                }
            }
        }

        final int rowsRead = drawResultsInCsvFormat.size();
        if (rejected > 0) {
            log.warn("{}: {}: rejected {} of {} row(s) as unparseable; stored {} draw(s)",
                    stateName, gameName, rejected, rowsRead, lotteryGame.getLotteryDraws().size());
        }
        if (lotteryGame.getLotteryDraws().isEmpty()) {
            // Fail the game rather than overwrite the existing store with an empty history.
            throw new IllegalStateException("No parseable draws for " + stateName + ": " + gameName
                    + " (" + rowsRead + " row(s) read)");
        }

        int size = lotteryGame.getLotteryDraws().size() - 1;
        lotteryGame.findMinMaxLottoNumber(stateName);
        lotteryGame.setDateLastUpdated(lotteryGame.getLotteryDraws().get(size).getDrawDate());
        lotteryGame.setDrawPositionCount(lotteryGame.getLotteryDraws().get(0).getDrawResults().size());
        lotteryGame.setDrawHistoryCount(lotteryGame.getLotteryDraws().size());

        // A failed write propagates so the poller reports the game as failed rather than succeeded.
        boolean isSerialized = this.lotteryGameSerializer.serialize(lotteryGame);
        log.info("Successfully serialized draw results for " + stateName + ": " + gameName + "= " + isSerialized);
        return new GameProcessingResult(rowsRead, rejected);
    }

    /**
     * Parses one CSV row into a draw.
     *
     * @throws IllegalArgumentException if the row is malformed (wrong column count, empty or non-numeric number)
     * @throws DateTimeException        if the month/day/year columns are not a valid date
     */
    static LotteryDraw parseDraw(String[] data, RowLayout layout) {
        if (data.length <= FIRST_NUMBER_COLUMN) {
            throw new IllegalArgumentException("expected numbers after column " + FIRST_NUMBER_COLUMN
                    + ", found " + data.length + " column(s)");
        }
        LotteryDraw lotteryDraw = new LotteryDraw();
        lotteryDraw.setDrawDate(getDrawDate(data));

        switch (layout) {
            case STANDARD:
                addNumbers(lotteryDraw, data, data.length - 1);
                Collections.sort(lotteryDraw.getDrawResults());
                break;
            case TRAILING_BONUS:
                lotteryDraw.setBonusNumber(parseNumber(data, data.length - 1, "bonus ball"));
                addNumbers(lotteryDraw, data, data.length - 2);
                Collections.sort(lotteryDraw.getDrawResults());
                break;
            case MULTI_STATE:
                if (data.length != RowLayout.MULTI_STATE_BONUS_COLUMN + 1
                        && data.length != RowLayout.MULTI_STATE_MULTIPLIER_COLUMN + 1) {
                    throw new IllegalArgumentException("expected " + (RowLayout.MULTI_STATE_BONUS_COLUMN + 1)
                            + " or " + (RowLayout.MULTI_STATE_MULTIPLIER_COLUMN + 1) + " columns, found " + data.length);
                }
                addNumbers(lotteryDraw, data, RowLayout.MULTI_STATE_BONUS_COLUMN - 1);
                Collections.sort(lotteryDraw.getDrawResults());
                lotteryDraw.setBonusNumber(parseNumber(data, RowLayout.MULTI_STATE_BONUS_COLUMN, "bonus ball"));
                if (data.length > RowLayout.MULTI_STATE_MULTIPLIER_COLUMN
                        && !data[RowLayout.MULTI_STATE_MULTIPLIER_COLUMN].trim().isEmpty()) {
                    lotteryDraw.setMultiplier(parseNumber(data, RowLayout.MULTI_STATE_MULTIPLIER_COLUMN, "multiplier"));
                }
                break;
            case FIREBALL:
                addNumbers(lotteryDraw, data, data.length - 3);
                break;
        }

        if (lotteryDraw.getDrawResults().isEmpty()) {
            throw new IllegalArgumentException("no winning numbers");
        }
        return lotteryDraw;
    }

    /** Adds {@code data[FIRST_NUMBER_COLUMN..lastColumn]} (inclusive) as winning numbers. */
    private static void addNumbers(LotteryDraw lotteryDraw, String[] data, int lastColumn) {
        for (int column = FIRST_NUMBER_COLUMN; column <= lastColumn; column++) {
            lotteryDraw.getDrawResults().add(parseNumber(data, column, "winning number"));
        }
    }

    private static int parseNumber(String[] data, int column, String what) {
        final String value = data[column].trim();
        if (value.isEmpty()) {
            throw new IllegalArgumentException(what + " in column " + column + " is empty");
        }
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(what + " in column " + column + " is not a number: '" + value + "'");
        }
    }

    private static LocalDate getDrawDate(String[] data) {
        final String date = data[3] + "-" + format(data[1]) + "-" + format(data[2]);
        final LocalDate drawDate = LocalDate.parse(date);
        return drawDate;
    }

    private static String format(String elementInDateString) {
        return (elementInDateString.length() == 1) ? ("0" + elementInDateString) : elementInDateString;
    }
}
