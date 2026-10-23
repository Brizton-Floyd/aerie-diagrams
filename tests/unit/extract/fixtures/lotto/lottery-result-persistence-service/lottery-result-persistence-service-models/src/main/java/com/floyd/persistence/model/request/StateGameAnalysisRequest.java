package com.floyd.persistence.model.request;

import lombok.Data;

import java.util.List;

@Data
public class StateGameAnalysisRequest {
    private String stateName;
    private String gameName;
    private String analysisMethod;
    private String drawPosition;
    private String gameOutRange;
    private int gamesInPast;
    private int groupSize = 8;
    private boolean generateDrawNumbers;
    private int numbersToGeneratePerPattern;
    private List<Integer> drawPositionsToExclude;
    private String[] drawLowHighPatterns;
    private int[] patternSegments;
    private String direction;
    private int pointer;
    private int drawResultUpperBound;
}
