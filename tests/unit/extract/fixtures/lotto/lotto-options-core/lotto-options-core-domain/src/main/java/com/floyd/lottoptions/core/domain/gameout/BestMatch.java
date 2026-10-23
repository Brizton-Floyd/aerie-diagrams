package com.floyd.lottoptions.core.domain.gameout;

/**
 * How close one replayed play came. A large-pool game is judged by how many of the draw's
 * numbers its whole-number pool trapped; a digit game only tells a full hit from no match.
 */
public enum BestMatch {
    /** A large-pool pool trapped every number drawn. */
    FULL_TRAP,
    /** A large-pool pool trapped all but one number drawn. */
    MINUS_1,
    /** A large-pool pool trapped all but two numbers drawn. */
    MINUS_2,
    /** A digit game's pools hit the draw at every position. */
    FULL_HIT,
    NO_MATCH
}
