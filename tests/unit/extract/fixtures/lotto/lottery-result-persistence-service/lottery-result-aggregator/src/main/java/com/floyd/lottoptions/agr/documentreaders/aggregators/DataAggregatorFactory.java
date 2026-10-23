package com.floyd.lottoptions.agr.documentreaders.aggregators;

import java.util.List;
import javax.xml.crypto.Data;

public class DataAggregatorFactory {

  public static DataAggregator getDataAggregator(String stateName, String gameName,
      List<String> lines) {
    switch (stateName) {
      case "LOUISIANA":
        return new LouisianaLottoDataAggregator(gameName, lines);
      default:
        return null;
    }
  }
}
