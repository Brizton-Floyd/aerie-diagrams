package com.floyd.lottoptions.agr.documentreaders.aggregators;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Predicate;

public class LouisianaLottoDataAggregator implements DataAggregator{
  private String gameName;
  private List<String> dataToProcess;

  public LouisianaLottoDataAggregator(String gameName, List<String> lines) {
    this.gameName = gameName;
    this.dataToProcess = lines;
  }

  @Override
  public void populateData(List<String[]> data) {
    purgeIncorrectDataFromResultSet();
    if (!gameName.equals("Pick 5")) {
      aggregateDataForGamesWithsNumberFieldGreaterThanNine(data);
    } else {
      aggregateData(data);
    }
  }

  private void purgeIncorrectDataFromResultSet() {
    Set<Character> validCharSet = new HashSet<>();
    validCharSet.add('/');
    validCharSet.add('-');
    validCharSet.add('$');

    Predicate<String> isStringInvalid = value -> {
      boolean valid = false;
      for (char c : value.toCharArray()) {
        if (validCharSet.contains(c)) {
          valid = true;
          break;
        }
      }
      return !valid;
    };

    dataToProcess.removeIf(isStringInvalid);
  }

  private void aggregateData(List<String[]> data) {
    for (int i = 1; i < dataToProcess.size(); i+=2) {
      String[] aggregatedData = new String[3];
      aggregatedData[0] = dataToProcess.get(i - 1);
      aggregatedData[1] = dataToProcess.get(i);
      data.add(aggregatedData);
    }
  }

  private void aggregateDataForGamesWithsNumberFieldGreaterThanNine(List<String[]> data) {
    for (int i = 2; i < dataToProcess.size(); i+=3) {
      String[] aggregatedData = new String[3];
      aggregatedData[0] = dataToProcess.get(i - 2);
      aggregatedData[1] = dataToProcess.get(i - 1);
      aggregatedData[2] = dataToProcess.get(i);
      data.add(aggregatedData);
    }
  }
}
