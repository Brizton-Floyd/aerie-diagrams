package com.floyd.lottoptions.snapshot;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.fail;

/**
 * Compares HTTP snapshots against committed goldens, or rewrites the goldens on request.
 *
 * <p>Normal runs assert that the actual status, content type and body bytes equal the golden.
 * On a mismatch the actual body is written to {@code target/golden-actual/} for diffing, and
 * the failure names the first differing byte offset. A missing golden fails too: goldens are
 * created deliberately, never silently.</p>
 *
 * <p>{@code -Dgolden.update=true} rewrites every golden whose content changed and leaves the
 * rest untouched, so two update runs in a row leave {@code git status} clean when Core is
 * deterministic. The property is never set in CI.</p>
 *
 * <p>Storage format: {@link SnapshotFiles}; PDF responses are stored as a
 * {@link PdfFingerprint} instead (see {@link #assertPdfMatches}), and text documents such as
 * recorded requests as plain text files (see {@link #assertTextMatches}).</p>
 */
public final class GoldenFiles {

    /** System property that switches from asserting to rewriting goldens. */
    public static final String UPDATE_PROPERTY = "golden.update";

    /** Core API goldens, in the fixtures module so the BFF snapshots can serve them (S05). */
    public static final Path CORE_GOLDEN_ROOT = Paths.get("..", "lotto-options-core-test-fixtures",
            "src", "main", "resources", "golden", "core");
    /** BFF route goldens (S05), next to the Core goldens they are computed from. */
    public static final Path BFF_GOLDEN_ROOT = Paths.get("..", "lotto-options-core-test-fixtures",
            "src", "main", "resources", "golden", "bff");
    private static final Path ACTUAL_ROOT = Paths.get("target", "golden-actual");
    private static final int EXCERPT_LENGTH = 160;
    private static final String PDF_FINGERPRINT_SUFFIX = ".pdf-fingerprint.txt";

    private final Path goldenRoot;
    private final Path actualRoot;
    private final boolean update;

    public GoldenFiles(Path goldenRoot, Path actualRoot, boolean update) {
        this.goldenRoot = goldenRoot;
        this.actualRoot = actualRoot;
        this.update = update;
    }

    /** The Core API goldens, honoring {@value #UPDATE_PROPERTY}. */
    public static GoldenFiles core() {
        return new GoldenFiles(CORE_GOLDEN_ROOT, ACTUAL_ROOT, Boolean.getBoolean(UPDATE_PROPERTY));
    }

    /** The BFF route goldens, honoring {@value #UPDATE_PROPERTY}. */
    public static GoldenFiles bff() {
        return new GoldenFiles(BFF_GOLDEN_ROOT, ACTUAL_ROOT, Boolean.getBoolean(UPDATE_PROPERTY));
    }

    /**
     * Asserts that {@code actual} equals golden {@code name}, or rewrites it in update mode.
     *
     * @param name   golden path relative to the golden root, without extension
     *               (for example {@code dashboard/texas/lotto-texas})
     * @param actual the response to compare
     */
    public void assertMatches(String name, HttpSnapshot actual) {
        if (update) {
            SnapshotFiles.writeIfChanged(goldenRoot, name, actual);
            return;
        }
        Optional<HttpSnapshot> golden = SnapshotFiles.read(goldenRoot, name);
        if (golden.isEmpty()) {
            fail("No golden %s under %s. Run with -D%s=true to create it.",
                    name, goldenRoot.toAbsolutePath().normalize(), UPDATE_PROPERTY);
            return;
        }
        HttpSnapshot expected = golden.get();
        if (expected.equals(actual)) {
            return;
        }
        Path actualFile = writeActual(name, actual);
        fail(describeMismatch(name, expected, actual, actualFile));
    }

    /**
     * Asserts that the PDF response {@code actual} equals PDF golden {@code name}, or rewrites it
     * in update mode. PDF goldens store the response's {@link PdfFingerprint} in
     * {@code <name>.pdf-fingerprint.txt}: status, content type and the normalized document.
     * On a mismatch the actual PDF and its fingerprint are written to {@code target/golden-actual/}.
     *
     * @param name   golden path relative to the golden root, without extension
     * @param actual the PDF response to compare
     */
    public void assertPdfMatches(String name, HttpSnapshot actual) {
        String fingerprint = PdfFingerprint.describe(actual);
        String file = name + PDF_FINGERPRINT_SUFFIX;
        differingGoldenText("PDF golden", name, file, fingerprint).ifPresent(expected -> {
            writeText(actualRoot.resolve(file), fingerprint);
            Path actualPdf = writeActual(name, actual);
            fail(describeLineMismatch("PDF golden mismatch for " + name, "fingerprint line", expected, fingerprint)
                    + "\n  actual PDF written to " + actualPdf.toAbsolutePath().normalize()
                    + "\n  if the change is intended, rerun with -D" + UPDATE_PROPERTY + "=true");
        });
    }

    /**
     * Asserts that the text {@code actual} equals text golden {@code file}, or rewrites it in
     * update mode. On a mismatch the actual text is written to {@code target/golden-actual/}.
     *
     * @param file   golden path relative to the golden root, with its extension
     *               (for example {@code catalog/states.core-requests.txt})
     * @param actual the text to compare
     */
    public void assertTextMatches(String file, String actual) {
        differingGoldenText("golden", file, file, actual).ifPresent(expected -> {
            Path actualFile = actualRoot.resolve(file);
            writeText(actualFile, actual);
            fail(describeLineMismatch("Golden mismatch for " + file, "line", expected, actual)
                    + "\n  actual text written to " + actualFile.toAbsolutePath().normalize()
                    + "\n  if the change is intended, rerun with -D" + UPDATE_PROPERTY + "=true");
        });
    }

    /**
     * In update mode, rewrites text golden {@code file} when it differs from {@code actual} and
     * returns empty. Otherwise fails when the golden is missing, and returns the golden's text
     * when it differs from {@code actual}.
     */
    private Optional<String> differingGoldenText(String kind, String name, String file, String actual) {
        Path golden = goldenRoot.resolve(file);
        Optional<String> expected = readText(golden);
        if (update) {
            if (!expected.equals(Optional.of(actual))) {
                writeText(golden, actual);
            }
            return Optional.empty();
        }
        if (expected.isEmpty()) {
            fail("No %s %s under %s. Run with -D%s=true to create it.",
                    kind, name, goldenRoot.toAbsolutePath().normalize(), UPDATE_PROPERTY);
        }
        return expected.filter(text -> !text.equals(actual));
    }

    private static String describeLineMismatch(String heading, String lineKind, String expected, String actual) {
        List<String> expectedLines = expected.lines().toList();
        List<String> actualLines = actual.lines().toList();
        int line = 0;
        while (line < expectedLines.size() && line < actualLines.size()
                && expectedLines.get(line).equals(actualLines.get(line))) {
            line++;
        }
        return heading + ": first difference at " + lineKind + " " + (line + 1)
                + "\n  expected: " + lineOrEnd(expectedLines, line)
                + "\n  actual:   " + lineOrEnd(actualLines, line);
    }

    private static String lineOrEnd(List<String> lines, int index) {
        return index < lines.size() ? lines.get(index) : "<end of text>";
    }

    private static Optional<String> readText(Path file) {
        if (!Files.isRegularFile(file)) {
            return Optional.empty();
        }
        try {
            return Optional.of(Files.readString(file, StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read " + file, e);
        }
    }

    private static void writeText(Path file, String text) {
        try {
            Files.createDirectories(file.getParent());
            Files.writeString(file, text, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot write " + file, e);
        }
    }

    private static String describeMismatch(String name, HttpSnapshot expected, HttpSnapshot actual,
                                           Path actualFile) {
        StringBuilder message = new StringBuilder("Golden mismatch for ").append(name).append(':');
        if (expected.status() != actual.status()) {
            message.append("\n  status: expected ").append(expected.status())
                    .append(" but was ").append(actual.status());
        }
        if (!expected.contentType().equals(actual.contentType())) {
            message.append("\n  content type: expected '").append(expected.contentType())
                    .append("' but was '").append(actual.contentType()).append('\'');
        }
        long offset = expected.firstBodyDifference(actual);
        if (offset >= 0) {
            message.append("\n  body: first difference at byte offset ").append(offset)
                    .append(" (expected ").append(expected.bodyLength())
                    .append(" bytes, actual ").append(actual.bodyLength()).append(" bytes)")
                    .append("\n  expected near offset: ").append(expected.bodyExcerpt(offset, EXCERPT_LENGTH))
                    .append("\n  actual near offset:   ").append(actual.bodyExcerpt(offset, EXCERPT_LENGTH));
        }
        message.append("\n  actual body written to ").append(actualFile.toAbsolutePath().normalize())
                .append("\n  if the change is intended, rerun with -D").append(UPDATE_PROPERTY).append("=true");
        return message.toString();
    }

    private Path writeActual(String name, HttpSnapshot actual) {
        Path file = actualRoot.resolve(SnapshotFiles.bodyName(name, actual.contentType()));
        try {
            Files.createDirectories(file.getParent());
            Files.write(file, actual.body());
            return file;
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot write actual body " + file, e);
        }
    }
}
