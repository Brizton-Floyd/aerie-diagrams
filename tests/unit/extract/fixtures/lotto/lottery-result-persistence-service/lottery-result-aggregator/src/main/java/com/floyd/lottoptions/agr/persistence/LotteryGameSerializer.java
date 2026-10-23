package com.floyd.lottoptions.agr.persistence;

import com.floyd.persistence.model.LotteryGame;
import org.springframework.stereotype.Component;

import java.io.BufferedOutputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.ObjectOutputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;

/**
 * Persists a {@link LotteryGame} to {@code {baseDir}/{STATE}/{Game}.ser}.
 *
 * <p>The write is <em>crash-safe</em>: the object is streamed to a temporary file in the
 * same directory, flushed to disk ({@code fsync}), and then atomically renamed over the
 * target. A reader therefore always observes either the previous complete file or the new
 * complete file, never a half-written one, and a crash mid-write cannot corrupt an existing
 * {@code .ser}.
 */
@Component
public class LotteryGameSerializer {

    static final String DEFAULT_BASE_DIR = "tmp";

    private final String baseDir;

    public LotteryGameSerializer() {
        this(DEFAULT_BASE_DIR);
    }

    public LotteryGameSerializer(String baseDir) {
        this.baseDir = (baseDir == null || baseDir.isBlank()) ? DEFAULT_BASE_DIR : baseDir;
    }

    public boolean serialize(LotteryGame lotteryGame) throws IOException {
        final String gameName = lotteryGame.getFullName();
        final Path stateDir = Paths.get(baseDir, lotteryGame.getStateGameBelongsTo().toUpperCase());
        Files.createDirectories(stateDir);

        final Path target = stateDir.resolve(gameName + ".ser");
        final Path tmp = Files.createTempFile(stateDir, gameName + "-", ".ser.tmp");

        try {
            try (FileOutputStream fileOut = new FileOutputStream(tmp.toFile());
                 ObjectOutputStream objectOut = new ObjectOutputStream(new BufferedOutputStream(fileOut))) {
                objectOut.writeObject(lotteryGame);
                objectOut.flush();
                // Force the bytes to stable storage before we publish the file via rename.
                fileOut.getFD().sync();
            }
            try {
                Files.move(tmp, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException atomicUnsupported) {
                // Rare (e.g. crossing filesystems); fall back to a best-effort replace.
                Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING);
            }
            return true;
        } finally {
            // No-op after a successful move; cleans up the temp file if anything above failed.
            Files.deleteIfExists(tmp);
        }
    }
}
