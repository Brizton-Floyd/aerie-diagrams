package com.floyd.lottoptions.server;

import com.floyd.lottoptions.config.PersistenceServiceProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication(scanBasePackages = {"com.floyd"})
@EnableConfigurationProperties(PersistenceServiceProperties.class)
public class LottoOptionsCoreApplication {

    public static void main(String[] args) {
        SpringApplication.run(LottoOptionsCoreApplication.class, args);
    }

}