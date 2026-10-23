package com.floyd.lottoptions.service.impl;

import com.floyd.lottoptions.service.DataService;
import com.floyd.persistence.model.LotteryGame;
import com.floyd.persistence.model.LotteryState;
import com.floyd.persistence.model.request.StateGameAnalysisRequest;
import com.floyd.persistence.model.response.AllStateLottoGameResponse;
import com.floyd.persistence.model.response.StateGamesResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Reads the {@code .ser} draw store and serves the catalog / game endpoints.
 *
 * <p>The expensive read methods are cached ({@link Cacheable}); the cache is invalidated
 * whenever a poll completes (see the read-side cache evictor). The storage root is
 * configurable via {@code lottery.storage.base-dir} (default {@code tmp}), which also gives
 * tests a seam to point the real production code at a temp directory.
 */
@Service
public class LotteryDataService implements DataService {

    private static final Logger log = LoggerFactory.getLogger(LotteryDataService.class);

    /** Cache names, invalidated together on {@code PollCompletedEvent}. */
    public static final String CACHE_GAME_DATA = "gameData";
    public static final String CACHE_CATALOG_V1 = "catalogV1";
    public static final String CACHE_CATALOG_V2 = "catalogV2";
    public static final String CACHE_STATE_GAME_NAMES = "stateGameNames";
    public static final String CACHE_STATES = "states";
    public static final String CACHE_STATE_GAMES = "stateGames";

    private final String baseDir;

    public LotteryDataService(@Value("${lottery.storage.base-dir:tmp}") String baseDir) {
        this.baseDir = (baseDir == null || baseDir.isBlank()) ? "tmp" : baseDir;
    }

    @Override
    @Cacheable(cacheNames = CACHE_GAME_DATA, key = "#stateGameAnalysisRequest.stateName + '::' + #stateGameAnalysisRequest.gameName")
    public Optional<StateGamesResponse> getStateData(StateGameAnalysisRequest stateGameAnalysisRequest) throws Exception {
        final String gameName = stateGameAnalysisRequest.getGameName();
        final String stateName = stateGameAnalysisRequest.getStateName();
        final StateGamesResponse response = new StateGamesResponse();

        final Path serFile = Paths.get(baseDir, stateDirectoryName(stateName), gameName + ".ser");
        if (!Files.isRegularFile(serFile)) {
            return Optional.of(response);
        }

        try (ObjectInputStream in = new ObjectInputStream(new BufferedInputStream(Files.newInputStream(serFile)))) {
            response.setLotteryGame((LotteryGame) in.readObject());
        } catch (IOException | ClassNotFoundException e) {
            log.error("Failed to read game '{}' for state '{}' from {}", gameName, stateName, serFile, e);
            throw e;
        }
        return Optional.of(response);
    }

    /**
     * Resolves a caller-supplied state name ({@code Texas}, {@code texas}, {@code TEXAS}) to its
     * store directory name. State directories are written upper-case, so every reader must
     * normalize through here; a raw name only matches on a case-insensitive filesystem.
     */
    static String stateDirectoryName(String stateName) {
        return stateName.toUpperCase(Locale.ROOT);
    }

    @Override
    @Cacheable(CACHE_STATES)
    public List<LotteryState> fetchStates() {
        List<LotteryState> lotteryStates = new ArrayList<>();
        for (String directoryName : listStateDirectories()) {
            LotteryState lotteryState = new LotteryState();
            lotteryState.setStateRegion(directoryName);
            lotteryStates.add(lotteryState);
        }
        return lotteryStates;
    }

    private List<String> listStateDirectories() {
        final Path root = Paths.get(baseDir);
        if (!Files.isDirectory(root)) {
            return List.of();
        }
        try (Stream<Path> paths = Files.walk(root, 1)) {
            return paths
                    .filter(Files::isDirectory)
                    .filter(path -> !path.equals(root))
                    .map(path -> path.getFileName().toString())
                    .collect(Collectors.toList());
        } catch (IOException e) {
            log.error("Failed to list state directories under {}", root, e);
            return List.of();
        }
    }

    @Override
    @Cacheable(cacheNames = CACHE_STATE_GAMES, key = "#stateName")
    public List<LotteryGame> fetchStateGames(String stateName) {
        final Path directory = Paths.get(baseDir, stateDirectoryName(stateName));
        final List<LotteryGame> lotteryGames = new ArrayList<>();
        if (!Files.isDirectory(directory)) {
            log.info("No game directory found for state '{}'.", stateName);
            return lotteryGames;
        }
        try (Stream<Path> paths = Files.list(directory)) {
            paths.filter(p -> p.getFileName().toString().endsWith(".ser"))
                    .forEach(p -> {
                        String fileName = p.getFileName().toString();
                        String nameWithoutExtension = fileName.substring(0, fileName.lastIndexOf('.'));
                        LotteryGame lotteryGame = new LotteryGame();
                        lotteryGame.setFullName(nameWithoutExtension);
                        lotteryGames.add(lotteryGame);
                    });
        } catch (IOException e) {
            log.error("Failed to list games for state '{}'", stateName, e);
        }
        return lotteryGames;
    }

    @Override
    @Cacheable(CACHE_CATALOG_V1)
    public Optional<AllStateLottoGameResponse> getAllStateLotteryGames() throws Exception {
        Map<String, List<LotteryGame>> map = buildCatalog();
        map.values().forEach(lst -> lst.sort(Comparator.comparing(LotteryGame::getFullName)));

        AllStateLottoGameResponse response = new AllStateLottoGameResponse();
        response.setAllStateLotteryGames(map);
        return Optional.of(response);
    }

    @Override
    @Cacheable(CACHE_CATALOG_V2)
    public Optional<AllStateLottoGameResponse> getAllStateLotteryGamesV2() throws Exception {
        Map<String, List<LotteryGame>> map = buildCatalog();
        map.values().forEach(lst -> lst.sort(Comparator.comparing(LotteryGame::getFullName)));

        List<LotteryState> lotteryStates = new ArrayList<>();
        map.forEach((state, games) -> {
            LotteryState lotteryState = new LotteryState();
            lotteryState.setStateRegion(state);
            lotteryState.setStateLotteryGames(games);
            lotteryStates.add(lotteryState);
        });

        AllStateLottoGameResponse response = new AllStateLottoGameResponse();
        response.setLotteryStateGames(lotteryStates);
        return Optional.of(response);
    }

    @Override
    @Cacheable(cacheNames = CACHE_STATE_GAME_NAMES, key = "#state")
    public Optional<List<String>> getAllStateLotteryGames(String state) throws Exception {
        final Path directory = Paths.get(baseDir, stateDirectoryName(state));
        final List<String> games = new ArrayList<>();
        if (!Files.isDirectory(directory)) {
            return Optional.of(games);
        }
        try (Stream<Path> paths = Files.list(directory)) {
            paths.forEach(p -> {
                String name = p.getFileName().toString();
                if (!name.endsWith(".ser")) {
                    return;
                }
                int index = name.indexOf('.');
                games.add(index >= 0 ? name.substring(0, index) : name);
            });
        } catch (IOException e) {
            log.error("Failed to list game names for state '{}'", state, e);
        }
        return Optional.of(games);
    }

    /**
     * Builds the lightweight catalog (name / min / max / drawPositionCount, no draws) by
     * deserializing each game once. Shared by both the v1 and v2 catalog endpoints.
     */
    private Map<String, List<LotteryGame>> buildCatalog() throws Exception {
        Map<String, List<LotteryGame>> map = new HashMap<>();
        listFilesForFolder(Paths.get(baseDir).toFile(), map, "");
        return map;
    }

    private void listFilesForFolder(final java.io.File folder, Map<String, List<LotteryGame>> map, String state) throws Exception {
        String currentState = state;
        if (!folder.exists()) {
            return;
        }
        java.io.File[] fList = folder.listFiles();
        if (fList == null) {
            return;
        }
        for (java.io.File file : fList) {
            if (file.isDirectory()) {
                currentState = file.getName().charAt(0) + file.getName().substring(1).toLowerCase();
                map.put(currentState, new ArrayList<>());
                listFilesForFolder(file, map, currentState);
            } else {
                if (!file.getName().endsWith(".ser")) {
                    continue;
                }
                String lotteryGameName = file.getName().split(Pattern.quote("."))[0];
                StateGameAnalysisRequest request = new StateGameAnalysisRequest();
                request.setStateName(currentState);
                request.setGameName(lotteryGameName);

                LotteryGame game;
                try {
                    game = getStateData(request).map(StateGamesResponse::getLotteryGame).orElse(null);
                } catch (Exception e) {
                    log.warn("Skipping unreadable game file '{}' for state '{}'.", file.getName(), currentState, e);
                    continue;
                }
                if (game == null) {
                    log.warn("Skipping unreadable game file '{}' for state '{}'.", file.getName(), currentState);
                    continue;
                }

                LotteryGame catalogGame = new LotteryGame();
                catalogGame.setFullName(game.getFullName());
                catalogGame.setStateGameBelongsTo(currentState);
                catalogGame.setMinNumber(game.getMinNumber());
                catalogGame.setMaxNumber(game.getMaxNumber());
                // FR-020-A: propagate drawPositionCount (authoritative source for v1 and v2 catalogs).
                if (game.getDrawPositionCount() != null) {
                    catalogGame.setDrawPositionCount(game.getDrawPositionCount());
                } else {
                    log.warn("drawPositionCount is null for game '{}' in state '{}' - "
                            + ".ser file may be stale and require re-aggregation.", game.getFullName(), currentState);
                }
                catalogGame.setLotteryDraws(null);
                map.get(currentState).add(catalogGame);
            }
        }
    }
}
