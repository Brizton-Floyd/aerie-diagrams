package com.floyd.lottoptions.agr.documentreaders;

import org.springframework.stereotype.Service;

@Service
public class FileReaderFactory {
    public FileReader getFileReader(FileReaderType fileReaderType) {
        switch (fileReaderType) {
            case CSV:
                return new CsvFileReader();
            case PDF:
                return new PdfFileReader();
            default:
                return null;
        }
    }
}
