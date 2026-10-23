package com.floyd.lottoptions.server;

import com.floyd.lottoptions.agr.config.LotteryRegionConfig;
import com.floyd.lottoptions.agr.config.LotteryUrlConfig;
import com.floyd.lottoptions.agr.polling.LotteryResultPollingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.data.mongo.MongoDataAutoConfiguration;
import org.springframework.boot.autoconfigure.mongo.MongoAutoConfiguration;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication(scanBasePackages =  {"com.floyd"},
        exclude = {MongoAutoConfiguration.class, MongoDataAutoConfiguration.class})
public class LotteryResultPersistenceServiceApplication implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(LotteryResultPersistenceServiceApplication.class);

    @Autowired
    private LotteryUrlConfig applicationConfig;

    @Autowired
    private LotteryRegionConfig lotteryRegionConfig;

    @Autowired LotteryResultPollingService lotteryResultPollingService;


    public static void main(String[] args) {
        log.info("im starting");
        SpringApplication.run(LotteryResultPersistenceServiceApplication.class, args);
    }

    @Override
    public void run(String... args) throws Exception {
        lotteryResultPollingService.pollForUpdatesToDrawResults();
    }
}

