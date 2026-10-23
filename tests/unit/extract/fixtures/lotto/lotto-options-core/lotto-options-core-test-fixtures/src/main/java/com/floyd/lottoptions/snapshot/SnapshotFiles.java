package com.floyd.lottoptions.snapshot;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Function;
import java.util.zip.Deflater;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

/**
 * The on-disk format shared by the results-service fixtures and the Core goldens in
 * {@code lotto-options-core-test-fixtures}.
 *
 * <p>A snapshot named {@code n} is two files:</p>
 * <ul>
 *   <li>{@code n.head}: a {@code status: <code>} line and a {@code content-type: <type>} line;</li>
 *   <li>{@code n.<ext>} or, for bodies over {@link #GZIP_THRESHOLD_BYTES}, {@code n.<ext>.gz}:
 *       the exact body bytes. The extension follows the content type ({@code json}, {@code pdf},
 *       {@code txt}, otherwise {@code bin}).</li>
 * </ul>
 *
 * <p>Names are slugged with {@link #slug}: lower case, runs of other characters replaced by
 * {@code -}.</p>
 *
 * <p>Gzip keeps the repository small; comparisons always run on the decompressed bytes, so a
 * different zlib never changes the outcome. {@code capture-fixtures.sh} writes the same format.</p>
 */
public final class SnapshotFiles {

    /** Bodies larger than this are stored gzipped. */
    static final int GZIP_THRESHOLD_BYTES = 64 * 1024;

    private static final String HEAD_SUFFIX = ".head";
    private static final String GZIP_SUFFIX = ".gz";
    private static final String STATUS_KEY = "status";
    private static final String CONTENT_TYPE_KEY = "content-type";

    private SnapshotFiles() {
        throw new AssertionError("no instances");
    }

    /** Reads snapshot {@code name} under {@code dir}, or empty when its head file does not exist. */
    public static Optional<HttpSnapshot> read(Path dir, String name) {
        return read(relative -> readFile(dir.resolve(relative)), name);
    }

    /** Reads snapshot {@code name} under classpath folder {@code folder}, or empty when absent. */
    public static Optional<HttpSnapshot> readResource(String folder, String name) {
        return read(relative -> readResourceBytes(folder + "/" + relative), name);
    }

    /**
     * Writes {@code snapshot} as {@code name} under {@code dir} unless the stored snapshot is
     * already equal to it, so an unchanged golden is never rewritten.
     *
     * @return {@code true} when files were written
     */
    static boolean writeIfChanged(Path dir, String name, HttpSnapshot snapshot) {
        Optional<HttpSnapshot> existing = read(dir, name);
        if (existing.isPresent() && existing.get().equals(snapshot)) {
            return false;
        }
        try {
            existing.ifPresent(old -> deleteBodies(dir, name, old.contentType()));
            deleteBodies(dir, name, snapshot.contentType());
            Path head = dir.resolve(name + HEAD_SUFFIX);
            Files.createDirectories(head.getParent());
            Files.writeString(head, formatHead(snapshot), StandardCharsets.UTF_8);
            Path body = dir.resolve(bodyName(name, snapshot.contentType()));
            if (snapshot.bodyLength() > GZIP_THRESHOLD_BYTES) {
                Files.write(body.resolveSibling(body.getFileName() + GZIP_SUFFIX), gzip(snapshot.body()));
            } else {
                Files.write(body, snapshot.body());
            }
            return true;
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot write snapshot " + name + " under " + dir, e);
        }
    }

    /** Returns the body file extension for a content type. */
    static String extensionFor(String contentType) {
        if (contentType.contains("json")) {
            return "json";
        }
        if (contentType.contains("pdf")) {
            return "pdf";
        }
        if (contentType.startsWith("text/")) {
            return "txt";
        }
        return "bin";
    }

    /** Slugs a state, game or case name for a snapshot path: {@code "Lotto Texas"} becomes {@code lotto-texas}. */
    public static String slug(String name) {
        return name.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
    }

    static String bodyName(String name, String contentType) {
        return name + "." + extensionFor(contentType);
    }

    private static Optional<HttpSnapshot> read(Function<String, Optional<byte[]>> source, String name) {
        Optional<byte[]> head = source.apply(name + HEAD_SUFFIX);
        if (head.isEmpty()) {
            return Optional.empty();
        }
        String headText = new String(head.get(), StandardCharsets.UTF_8);
        int status = Integer.parseInt(headValue(headText, STATUS_KEY, name));
        String contentType = headValue(headText, CONTENT_TYPE_KEY, name);

        String bodyName = bodyName(name, contentType);
        Optional<byte[]> plain = source.apply(bodyName);
        Optional<byte[]> gzipped = source.apply(bodyName + GZIP_SUFFIX);
        if (plain.isPresent() && gzipped.isPresent()) {
            throw new IllegalStateException("Both " + bodyName + " and " + bodyName + GZIP_SUFFIX
                    + " exist; delete the stale one");
        }
        byte[] body = plain.or(() -> gzipped.map(SnapshotFiles::gunzip))
                .orElseThrow(() -> new IllegalStateException("Snapshot " + name + " has a head but no body "
                        + bodyName + "[" + GZIP_SUFFIX + "]"));
        return Optional.of(new HttpSnapshot(status, contentType, body));
    }

    private static String formatHead(HttpSnapshot snapshot) {
        return STATUS_KEY + ": " + snapshot.status() + "\n"
                + CONTENT_TYPE_KEY + ": " + snapshot.contentType() + "\n";
    }

    private static String headValue(String headText, String key, String name) {
        String prefix = key + ":";
        return headText.lines()
                .filter(line -> line.startsWith(prefix))
                .map(line -> line.substring(prefix.length()).trim())
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Snapshot head " + name + " has no " + key + " line"));
    }

    private static void deleteBodies(Path dir, String name, String contentType) {
        Path body = dir.resolve(bodyName(name, contentType));
        try {
            Files.deleteIfExists(body);
            Files.deleteIfExists(body.resolveSibling(body.getFileName() + GZIP_SUFFIX));
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot delete " + body, e);
        }
    }

    private static Optional<byte[]> readFile(Path path) {
        if (!Files.isRegularFile(path)) {
            return Optional.empty();
        }
        try {
            return Optional.of(Files.readAllBytes(path));
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read " + path, e);
        }
    }

    private static Optional<byte[]> readResourceBytes(String resource) {
        try (InputStream in = SnapshotFiles.class.getClassLoader().getResourceAsStream(resource)) {
            return in == null ? Optional.empty() : Optional.of(in.readAllBytes());
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read classpath resource " + resource, e);
        }
    }

    private static byte[] gunzip(byte[] compressed) {
        try (InputStream in = new GZIPInputStream(new ByteArrayInputStream(compressed))) {
            return in.readAllBytes();
        } catch (IOException e) {
            throw new UncheckedIOException("Corrupt gzip snapshot body", e);
        }
    }

    private static byte[] gzip(byte[] raw) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream(raw.length / 8);
        try (OutputStream out = new BestCompressionGzipOutputStream(bytes)) {
            out.write(raw);
        }
        return bytes.toByteArray();
    }

    /** A gzip stream at the best compression level; the JDK class exposes no level setter. */
    private static final class BestCompressionGzipOutputStream extends GZIPOutputStream {
        BestCompressionGzipOutputStream(OutputStream out) throws IOException {
            super(out);
            def.setLevel(Deflater.BEST_COMPRESSION);
        }
    }
}
