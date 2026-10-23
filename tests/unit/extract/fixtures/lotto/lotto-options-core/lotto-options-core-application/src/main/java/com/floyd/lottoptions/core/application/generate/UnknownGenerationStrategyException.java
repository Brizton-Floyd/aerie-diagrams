package com.floyd.lottoptions.core.application.generate;

/**
 * Thrown when a generate request's {@code numberGenerator} names no {@link GenerationStrategy}.
 * The Core API answers 400 for it, listing {@link GenerationStrategy#acceptedWireNames()}.
 */
public final class UnknownGenerationStrategyException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /**
     * @param requested the value the request sent; may be {@code null}
     */
    public UnknownGenerationStrategyException(String requested) {
        super("Unknown numberGenerator '" + requested + "'. Accepted values: "
                + GenerationStrategy.acceptedWireNames());
    }
}
