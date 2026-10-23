package com.floyd.lottoptions.bff;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

import com.floyd.lottoptions.bff.config.CoreApiPropertiesConfig;

/**
 * Entry point for the Lotto Options BFF (Backend-for-Frontend) service.
 *
 * <p>The BFF tier sits between the Angular Web UI and the Core API. It
 * orchestrates calls to the Core API and returns one slim, per-screen view
 * model per endpoint. It holds no domain logic - all lottery business rules
 * remain in the Core API.</p>
 *
 * <p>Runs on port 8080, bound to localhost. The Core API runs on port 8002.</p>
 */
@SpringBootApplication(scanBasePackages = {"com.floyd"})
@EnableConfigurationProperties(CoreApiPropertiesConfig.class)
public class LottoOptionsBffApplication {

    public static void main(String[] args) {
        SpringApplication.run(LottoOptionsBffApplication.class, args);
    }
}
