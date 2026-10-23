package com.floyd.lottoptions.snapshot;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Objects;

/**
 * One HTTP response as the snapshot safety net stores it: status, content type and
 * the exact body bytes. Headers other than the content type are deliberately not
 * part of a snapshot.
 *
 * <p>Immutable: the body is copied on the way in and on the way out.</p>
 *
 * @param status      HTTP status code
 * @param contentType the {@code Content-Type} header value, or {@code ""} when absent
 * @param body        the body bytes (empty when the response has no body)
 */
public record HttpSnapshot(int status, String contentType, byte[] body) {

    public HttpSnapshot {
        Objects.requireNonNull(contentType, "contentType");
        body = Objects.requireNonNull(body, "body").clone();
    }

    @Override
    public byte[] body() {
        return body.clone();
    }

    /** Returns the body length without copying it. */
    int bodyLength() {
        return body.length;
    }

    /**
     * Returns the offset of the first byte at which the two bodies differ, or
     * {@code -1} when they are identical.
     */
    long firstBodyDifference(HttpSnapshot other) {
        return Arrays.mismatch(body, other.body);
    }

    /** Returns up to {@code length} body characters around {@code offset}, for failure messages. */
    String bodyExcerpt(long offset, int length) {
        int from = (int) Math.max(0, Math.min(offset - length / 2, body.length));
        int to = Math.min(body.length, from + length);
        return new String(body, from, to - from, StandardCharsets.UTF_8);
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof HttpSnapshot other
                && status == other.status
                && contentType.equals(other.contentType)
                && Arrays.equals(body, other.body);
    }

    @Override
    public int hashCode() {
        return Objects.hash(status, contentType, Arrays.hashCode(body));
    }

    @Override
    public String toString() {
        return "HttpSnapshot[status=" + status + ", contentType=" + contentType
                + ", body=" + body.length + " bytes]";
    }
}
