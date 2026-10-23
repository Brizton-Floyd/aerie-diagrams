package com.floyd.lottoptions.agr.processor;

import com.floyd.lottoptions.agr.config.LotteryUrlConfig;
import com.floyd.lottoptions.agr.config.LotteryUrlConfig.GameInfo;
import com.floyd.lottoptions.agr.documentreaders.FileReader;
import com.floyd.lottoptions.agr.persistence.LotteryGameSerializer;
import com.floyd.lottoptions.agr.polling.LotteryResultPollingService;
import com.floyd.persistence.model.LotteryDraw;
import com.floyd.persistence.model.LotteryGame;
import java.io.IOException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class LouisianaLotteryHistoryProcessor implements HistoryProcessor {

  protected static final Logger log = LoggerFactory
      .getLogger(LouisianaLotteryHistoryProcessor.class);

  private final FileReader fileReader;
  private final LotteryGameSerializer lotteryGameSerializer;

  public LouisianaLotteryHistoryProcessor(FileReader fileReader,
      LotteryGameSerializer lotteryGameSerializer) {
    this.fileReader = fileReader;
    this.lotteryGameSerializer = lotteryGameSerializer;
  }

  @Override
  public void getHistoricalData(String name, List<GameInfo> gameInfo) throws Exception {
    log.info("Updating Results Lotto Games for: " + name);

    for (LotteryUrlConfig.GameInfo info : gameInfo) {
      List<String[]> drawResultsInCsvFormat = this.fileReader.getFileContents(info);
      if (drawResultsInCsvFormat.size() > 8000) {
        // This will help ensure the serialization of only the past 8000 lottery draw results
        drawResultsInCsvFormat = drawResultsInCsvFormat
            .subList(drawResultsInCsvFormat.size() - 8000,
                drawResultsInCsvFormat.size());
      }

      // Begin the serialization process
       processDrawResultsForGivenGame(info.getName(), name, drawResultsInCsvFormat);
    }
  }

  private void processDrawResultsForGivenGame(String lottoGameName, String stateName,
      List<String[]> drawResultsInCsvFormat) {
    switch (lottoGameName) {
      case "Easy 5":
      case "Lotto":
      case "Pick 5":
        serializeDrawResults(lottoGameName, drawResultsInCsvFormat, stateName);
        break;
    }
  }

  private void serializeDrawResults(String gameName,
      List<String[]> drawResultsInCsvFormat,
      String stateName) {

    log.info("Beginning serialization for " + stateName + ": " + gameName);
    LotteryGame lotteryGame = new LotteryGame();
    lotteryGame.setStateGameBelongsTo(stateName);
    lotteryGame.setFullName(gameName);
    lotteryGame.setLotteryDraws(new ArrayList<>());

    for (String[] data : drawResultsInCsvFormat) {
      LotteryDraw lotteryDraw = new LotteryDraw();
      final LocalDate drawDate = getDrawDate(data[0]);
      lotteryDraw.setDrawDate(drawDate);
      lotteryDraw.setDrawResults(extractNumericalValuesFromDrawResultString(data[1]));
      lotteryGame.getLotteryDraws().add(lotteryDraw);
    }

    lotteryGame.sortByDrawDateDescending();


    int size = lotteryGame.getLotteryDraws().size() - 1;
    lotteryGame.findMinMaxLottoNumber(stateName);
    lotteryGame.setDateLastUpdated(lotteryGame.getLotteryDraws().get(size).getDrawDate());
    lotteryGame
        .setDrawPositionCount(lotteryGame.getLotteryDraws().get(0).getDrawResults().size());
    lotteryGame.setDrawHistoryCount(lotteryGame.getLotteryDraws().size());

    try {
      boolean isSerialized = this.lotteryGameSerializer.serialize(lotteryGame);
      log.info("Successfully serialized draw results for " + stateName + ": " + gameName + "= "
          + isSerialized);
    } catch (IOException e) {
      log.error("Error happened during serialization of: " + gameName, e);
    }
  }

  private List<Integer> extractNumericalValuesFromDrawResultString(String drawResults) {
    String[] drawNumbers = drawResults.split("-");
    List<Integer> data = new ArrayList<>();

    for (String val : drawNumbers) {
      data.add(Integer.parseInt(val.trim()));
    }

    return data;
  }


  private LocalDate getDrawDate(String dataString) {
    String[] data = dataString.split("/");
    final String date = data[2] + "-" + format(data[0]) + "-" + format(data[1]);
    final LocalDate drawDate = LocalDate.parse(date);
    return drawDate;
  }

  private String format(String elementInDateString) {
    return (elementInDateString.length() == 1) ? ("0" + elementInDateString) : elementInDateString;
  }
}
