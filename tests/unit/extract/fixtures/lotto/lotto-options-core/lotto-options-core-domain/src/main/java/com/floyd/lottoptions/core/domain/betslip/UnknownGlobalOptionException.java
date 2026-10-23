package com.floyd.lottoptions.core.domain.betslip;

import java.util.List;

/**
 * The betslip has no global option by the requested name.
 */
public final class UnknownGlobalOptionException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /**
     * @param requested the option asked for
     * @param available the slip's options, as the slip names them
     */
    public UnknownGlobalOptionException(String requested, List<String> available) {
        super("Global option '" + requested + "' not found. Available: " + available);
    }
}
