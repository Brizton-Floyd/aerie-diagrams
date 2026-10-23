package com.floyd.lottoptions.config;

import com.floyd.lottoptions.service.impl.LotteryDataService;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * In-memory caching for the read/catalog endpoints. Sufficient for a single instance; each
 * entry is invalidated when a poll completes (see {@code CatalogCacheEvictor}).
 */
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        return new ConcurrentMapCacheManager(
                LotteryDataService.CACHE_GAME_DATA,
                LotteryDataService.CACHE_CATALOG_V1,
                LotteryDataService.CACHE_CATALOG_V2,
                LotteryDataService.CACHE_STATE_GAME_NAMES,
                LotteryDataService.CACHE_STATES,
                LotteryDataService.CACHE_STATE_GAMES);
    }
}
