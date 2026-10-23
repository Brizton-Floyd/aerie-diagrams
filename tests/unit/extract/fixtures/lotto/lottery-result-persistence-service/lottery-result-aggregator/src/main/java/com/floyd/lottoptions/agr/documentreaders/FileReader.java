package com.floyd.lottoptions.agr.documentreaders;

import com.floyd.lottoptions.agr.config.LotteryUrlConfig;
import com.opencsv.exceptions.CsvException;

import java.io.IOException;
import java.util.List;

public interface FileReader {
    List<String[]> getFileContents(LotteryUrlConfig.GameInfo gameInfo) throws IOException, CsvException;
    void setLottoStateName(String lottoStateName);
}
