package com.floyd.lottoptions.agr.documentreaders;

import com.floyd.lottoptions.agr.config.LotteryUrlConfig;
import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvException;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.net.URL;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.util.List;

public class CsvFileReader implements FileReader{
    private String lottoStateName;

    @Override
    public List<String[]> getFileContents(LotteryUrlConfig.GameInfo gameInfo) throws IOException, CsvException {
        final URLConnection connection = new URL(gameInfo.getUrl()).openConnection();
        connection.setConnectTimeout(HttpTimeouts.CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(HttpTimeouts.READ_TIMEOUT_MS);
        try (InputStream input = connection.getInputStream();
             Reader reader = new InputStreamReader(input, StandardCharsets.UTF_8);
             CSVReader csvReader = new CSVReader(reader)) {
            return csvReader.readAll();
        }
    }

    @Override
    public void setLottoStateName(String lottoStateName) {
        this.lottoStateName = lottoStateName;
    }
}
