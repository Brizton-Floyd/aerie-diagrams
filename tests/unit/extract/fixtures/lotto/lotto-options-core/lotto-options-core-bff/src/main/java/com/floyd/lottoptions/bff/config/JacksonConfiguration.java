package com.floyd.lottoptions.bff.config;

import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.MapperFeature;
import tools.jackson.databind.cfg.ConstructorDetector;

/**
 * Completes {@code spring.jackson.use-jackson2-defaults}: the Boot-managed Jackson 3 mapper reads
 * JSON as Boot 3's Jackson 2 mapper did.
 *
 * <p>Boot 3's mapper had Jackson 2's parameter-names module, which the Jackson 2 defaults leave
 * out, so constructor parameter names are detected again: classes with only an all-arguments
 * constructor need them. With the names known, Jackson 3 would
 * also build a type that has a no-arg constructor through its all-arguments constructor, dropping
 * field defaults (such as {@code GameOutRecommendationRequest.hPoolSize = 6}) for absent
 * properties; Jackson 2 used the no-arg constructor and setters, and so does this mapper.</p>
 *
 * <p>Runs after Boot's own customizer (order 0), which sets the constructor detector.</p>
 */
@Configuration(proxyBeanMethods = false)
public class JacksonConfiguration {

    /**
     * Detects constructor parameter names, but never prefers an implicit constructor over a
     * no-arg one.
     */
    @Bean
    public JsonMapperBuilderCustomizer jackson2CreatorDetection() {
        return builder -> builder
                .enable(MapperFeature.DETECT_PARAMETER_NAMES)
                .constructorDetector(ConstructorDetector.DEFAULT.withAllowImplicitWithDefaultConstructor(false));
    }
}
