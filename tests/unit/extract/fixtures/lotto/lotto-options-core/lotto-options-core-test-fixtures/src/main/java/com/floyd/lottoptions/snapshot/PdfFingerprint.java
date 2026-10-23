package com.floyd.lottoptions.snapshot;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.cos.COSArray;
import org.apache.pdfbox.cos.COSBase;
import org.apache.pdfbox.cos.COSBoolean;
import org.apache.pdfbox.cos.COSDictionary;
import org.apache.pdfbox.cos.COSDocument;
import org.apache.pdfbox.cos.COSFloat;
import org.apache.pdfbox.cos.COSInteger;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.cos.COSNull;
import org.apache.pdfbox.cos.COSObject;
import org.apache.pdfbox.cos.COSObjectKey;
import org.apache.pdfbox.cos.COSStream;
import org.apache.pdfbox.cos.COSString;
import org.apache.pdfbox.pdmodel.PDDocument;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The normalized form of a PDF response that a betslip golden stores: a short text listing of
 * the document's objects, with each stream's decoded bytes reduced to their length and SHA-256.
 *
 * <p>Normalization, per the owner's decision on #43 ("strip or fix the creation date and
 * document ID, then compare bytes"):</p>
 * <ul>
 *   <li>The trailer {@code /ID} and any {@code /CreationDate} or {@code /ModDate} are left out:
 *       they change on every render.</li>
 *   <li>Streams are compared by their <em>decoded</em> bytes ({@code /FlateDecode} undone), and
 *       {@code /Length} is left out. Compressed bytes depend on the zlib build the JVM links
 *       (macOS and the Linux CI runner differ), while the decoded pixels and page operators do
 *       not. Streams with any other filter are compared as stored.</li>
 *   <li>The cross-reference and object streams are left out: they only locate the objects,
 *       and every object they hold is listed on its own.</li>
 * </ul>
 *
 * <p>Everything else is compared exactly: every object's dictionary, every page's content
 * stream, and every slip image's pixels. Moving one mark by one pixel changes a digest.</p>
 *
 * <p>Why a digest and not the PDF itself: a betslip PDF embeds full-resolution slip images
 * (0.7 to 17 MB per response, already compressed), far too much to commit for the grid. On a
 * mismatch {@link GoldenFiles#assertPdfMatches} writes the actual PDF for inspection.</p>
 */
public final class PdfFingerprint {

    private static final byte[] PDF_MAGIC = "%PDF-".getBytes(StandardCharsets.US_ASCII);
    private static final Set<COSName> IGNORED_KEYS = Set.of(
            COSName.LENGTH, COSName.CREATION_DATE, COSName.MOD_DATE);
    private static final List<COSName> TRAILER_KEYS = List.of(COSName.ROOT, COSName.INFO, COSName.ENCRYPT);
    private static final Set<COSName> LOCATOR_STREAM_TYPES = Set.of(COSName.XREF, COSName.OBJ_STM);
    private static final int BUFFER_BYTES = 64 * 1024;

    private PdfFingerprint() {
        throw new AssertionError("no instances");
    }

    /**
     * Describes {@code snapshot}: its status and content type, then the normalized PDF. A body
     * that is not a PDF is described by its length and SHA-256.
     */
    public static String describe(HttpSnapshot snapshot) {
        StringBuilder out = new StringBuilder()
                .append("status: ").append(snapshot.status()).append('\n')
                .append("content-type: ").append(snapshot.contentType()).append('\n');
        byte[] body = snapshot.body();
        if (!startsWithPdfMagic(body)) {
            return out.append("body: not a PDF, ").append(body.length).append(" bytes, sha-256 ")
                    .append(sha256(body)).append('\n').toString();
        }
        try (PDDocument document = Loader.loadPDF(body)) {
            describeDocument(document.getDocument(), out);
            return out.toString();
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot parse the PDF body", e);
        }
    }

    private static void describeDocument(COSDocument document, StringBuilder out) throws IOException {
        out.append("version: ").append(document.getVersion()).append('\n');
        out.append("trailer:");
        COSDictionary trailer = document.getTrailer();
        for (COSName key : TRAILER_KEYS) {
            if (trailer.containsKey(key)) {
                out.append(" /").append(key.getName()).append(' ');
                appendValue(trailer.getItem(key), out);
            }
        }
        out.append('\n');

        List<COSObjectKey> keys = new ArrayList<>(document.getXrefTable().keySet());
        keys.sort(Comparator.comparingLong(COSObjectKey::getNumber).thenComparingInt(COSObjectKey::getGeneration));
        for (COSObjectKey key : keys) {
            COSBase object = document.getObjectFromPool(key).getObject();
            if (object == null || isLocatorStream(object)) {
                continue;
            }
            out.append(key.getNumber()).append(' ').append(key.getGeneration()).append(": ");
            appendValue(object, out);
            if (object instanceof COSStream stream) {
                appendStreamData(stream, out);
            }
            out.append('\n');
        }
    }

    private static boolean isLocatorStream(COSBase object) {
        if (!(object instanceof COSStream stream)) {
            return false;
        }
        COSName type = stream.getCOSName(COSName.TYPE);
        return type != null && LOCATOR_STREAM_TYPES.contains(type);
    }

    /** Writes a direct value canonically; indirect references are written as references. */
    private static void appendValue(COSBase value, StringBuilder out) {
        if (value instanceof COSObject reference) {
            COSObjectKey key = reference.getKey();
            out.append(key.getNumber()).append(' ').append(key.getGeneration()).append(" R");
        } else if (value instanceof COSDictionary dictionary) {
            appendDictionary(dictionary, out);
        } else if (value instanceof COSArray array) {
            out.append('[');
            for (int i = 0; i < array.size(); i++) {
                if (i > 0) {
                    out.append(' ');
                }
                appendValue(array.get(i), out);
            }
            out.append(']');
        } else if (value instanceof COSName name) {
            out.append('/').append(name.getName());
        } else if (value instanceof COSString string) {
            out.append('<').append(string.toHexString()).append('>');
        } else if (value instanceof COSInteger integer) {
            out.append(integer.longValue());
        } else if (value instanceof COSFloat number) {
            out.append(number.floatValue());
        } else if (value instanceof COSBoolean bool) {
            out.append(bool.getValue());
        } else if (value == null || value instanceof COSNull) {
            out.append("null");
        } else {
            throw new IllegalArgumentException("Unexpected PDF value " + value.getClass().getName());
        }
    }

    private static void appendDictionary(COSDictionary dictionary, StringBuilder out) {
        out.append("<<");
        List<Map.Entry<COSName, COSBase>> entries = new ArrayList<>(dictionary.entrySet());
        entries.sort(Map.Entry.comparingByKey(Comparator.comparing(COSName::getName)));
        for (Map.Entry<COSName, COSBase> entry : entries) {
            if (IGNORED_KEYS.contains(entry.getKey())) {
                continue;
            }
            out.append('/').append(entry.getKey().getName()).append(' ');
            appendValue(entry.getValue(), out);
            out.append(' ');
        }
        out.append(">>");
    }

    private static void appendStreamData(COSStream stream, StringBuilder out) throws IOException {
        boolean decode = isFlateOnly(stream.getFilters());
        MessageDigest digest = newSha256();
        long length = 0;
        try (InputStream in = decode ? stream.createInputStream() : stream.createRawInputStream()) {
            byte[] buffer = new byte[BUFFER_BYTES];
            for (int read = in.read(buffer); read >= 0; read = in.read(buffer)) {
                digest.update(buffer, 0, read);
                length += read;
            }
        }
        out.append(decode ? " decoded " : " stored ").append(length).append(" bytes, sha-256 ")
                .append(HexFormat.of().formatHex(digest.digest()));
    }

    private static boolean isFlateOnly(COSBase filters) {
        if (filters == null) {
            return true;
        }
        if (filters instanceof COSName name) {
            return COSName.FLATE_DECODE.equals(name);
        }
        if (filters instanceof COSArray array) {
            for (int i = 0; i < array.size(); i++) {
                if (!COSName.FLATE_DECODE.equals(array.getObject(i))) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }

    private static boolean startsWithPdfMagic(byte[] body) {
        return body.length >= PDF_MAGIC.length
                && Arrays.equals(body, 0, PDF_MAGIC.length, PDF_MAGIC, 0, PDF_MAGIC.length);
    }

    private static String sha256(byte[] bytes) {
        return HexFormat.of().formatHex(newSha256().digest(bytes));
    }

    private static MessageDigest newSha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("Every JVM provides SHA-256", e);
        }
    }
}
