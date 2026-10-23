package com.floyd.lottoptions.architecture;

import com.tngtech.archunit.library.freeze.ViolationLineMatcher;

/**
 * Matches a frozen package cycle by the slices it runs through, ignoring its dependency details.
 *
 * <p>ArchUnit reports a cycle as one violation: the slice path, then up to
 * {@code cycles.maxNumberOfDependenciesPerEdge} class dependencies per edge and a count of the
 * omitted rest. With the default matcher, removing one dependency from a frozen cycle (progress)
 * would turn it into a new violation and fail the build. This matcher keeps the cycle known for as
 * long as the same slices form it, and the store entry drops once the cycle is broken.</p>
 *
 * <p>Use it only on cycle rules: {@code freeze(rule).associateViolationLinesVia(new SameCycleMatcher())}.</p>
 */
public final class SameCycleMatcher implements ViolationLineMatcher {

    private static final String DETAILS_START = "\n  1. Dependencies of ";

    @Override
    public boolean matches(String lineFromFirstViolation, String lineFromSecondViolation) {
        return cyclePath(lineFromFirstViolation).equals(cyclePath(lineFromSecondViolation));
    }

    private static String cyclePath(String violation) {
        int details = violation.indexOf(DETAILS_START);
        return details < 0 ? violation : violation.substring(0, details);
    }
}
