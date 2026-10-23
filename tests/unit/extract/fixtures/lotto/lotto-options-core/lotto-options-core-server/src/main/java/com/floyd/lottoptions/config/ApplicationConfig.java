package com.floyd.lottoptions.config;

import org.springframework.context.annotation.Bean;
import org.springframework.http.codec.json.JacksonJsonDecoder;
import org.springframework.http.codec.json.JacksonJsonEncoder;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import tools.jackson.databind.json.JsonMapper;

@Component
public class ApplicationConfig {

    /**
     * The results-service client. Its JSON codecs use the Boot-managed mapper, so requests and
     * responses follow the {@code spring.jackson} settings; Spring's default codecs would build
     * their own mapper with plain Jackson 3 defaults.
     *
     * @param jsonMapper the Boot-managed JSON mapper
     * @return the results-service web client
     */
    @Bean
    public WebClient getWebClientBuilder(JsonMapper jsonMapper) {
        return WebClient.builder().exchangeStrategies(ExchangeStrategies.builder()
                .codecs(configurer -> {
                    configurer.defaultCodecs().jacksonJsonDecoder(new JacksonJsonDecoder(jsonMapper));
                    configurer.defaultCodecs().jacksonJsonEncoder(new JacksonJsonEncoder(jsonMapper));
                    configurer.defaultCodecs().maxInMemorySize(16 * 1024 * 1024);
                })
                .build())
                .build();
    }
}
