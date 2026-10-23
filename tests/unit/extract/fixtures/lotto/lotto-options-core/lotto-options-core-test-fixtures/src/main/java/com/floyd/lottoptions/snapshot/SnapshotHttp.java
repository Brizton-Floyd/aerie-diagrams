package com.floyd.lottoptions.snapshot;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Calls a service under test (Core or the BFF) on {@code localhost} over real HTTP and returns
 * the response as an {@link HttpSnapshot}.
 *
 * <p>Requests go through the JDK {@link HttpClient}, which sends no {@code Accept-Encoding},
 * so response compression stays off and the body bytes are exactly what the service writes.</p>
 */
public final class SnapshotHttp {

    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(60);
    private static final Pattern ERROR_TIMESTAMP = Pattern.compile("^\\{\"timestamp\":\"[^\"]*\"");
    private static final String NORMALIZED_TIMESTAMP = "{\"timestamp\":\"<normalized>\"";

    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(REQUEST_TIMEOUT)
            .build();

    private SnapshotHttp() {
        throw new AssertionError("no instances");
    }

    /** GETs {@code path} (unencoded; spaces are allowed, and a query may follow {@code ?}) on {@code port}. */
    public static HttpSnapshot get(int port, String path) {
        return send(HttpRequest.newBuilder(uri(port, path)).GET());
    }

    /** POSTs a JSON body to {@code path} on {@code port}. */
    public static HttpSnapshot postJson(int port, String path, String json) {
        return send(HttpRequest.newBuilder(uri(port, path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8)));
    }

    /**
     * Fixes the {@code timestamp} of Spring Boot's default error body, the one value in an
     * error response that changes on every call. Success bodies are returned unchanged.
     */
    public static HttpSnapshot normalizeErrorTimestamp(HttpSnapshot snapshot) {
        if (snapshot.status() < 400) {
            return snapshot;
        }
        String body = new String(snapshot.body(), StandardCharsets.UTF_8);
        Matcher matcher = ERROR_TIMESTAMP.matcher(body);
        if (!matcher.find()) {
            return snapshot;
        }
        String normalized = NORMALIZED_TIMESTAMP + body.substring(matcher.end());
        return new HttpSnapshot(snapshot.status(), snapshot.contentType(),
                normalized.getBytes(StandardCharsets.UTF_8));
    }

    private static URI uri(int port, String pathAndQuery) {
        int queryStart = pathAndQuery.indexOf('?');
        String path = queryStart < 0 ? pathAndQuery : pathAndQuery.substring(0, queryStart);
        String query = queryStart < 0 ? null : pathAndQuery.substring(queryStart + 1);
        try {
            return new URI("http", null, "localhost", port, path, query, null);
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("Bad path " + pathAndQuery, e);
        }
    }

    private static HttpSnapshot send(HttpRequest.Builder request) {
        HttpRequest built = request.timeout(REQUEST_TIMEOUT).build();
        try {
            HttpResponse<byte[]> response = CLIENT.send(built, HttpResponse.BodyHandlers.ofByteArray());
            String contentType = response.headers().firstValue("Content-Type").orElse("");
            return new HttpSnapshot(response.statusCode(), contentType, response.body());
        } catch (IOException e) {
            throw new UncheckedIOException("Request " + built.method() + " " + built.uri() + " failed", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while calling " + built.uri(), e);
        }
    }
}
