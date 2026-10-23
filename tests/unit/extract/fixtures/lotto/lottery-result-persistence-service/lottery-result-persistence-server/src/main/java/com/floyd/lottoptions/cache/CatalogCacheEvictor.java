package com.floyd.lottoptions.cache;

import com.floyd.lottoptions.agr.polling.PollCompletedEvent;
import com.floyd.lottoptions.service.impl.LotteryDataService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Invalidates every read/catalog cache when a poll finishes, so the freshly-written
 * {@code .ser} store becomes visible on the next request. The poll is the only writer, so
 * evict-on-poll bounds staleness to a single poll cycle.
 */
@Component
public class CatalogCacheEvictor {

    private static final Logger log = LoggerFactory.getLogger(CatalogCacheEvictor.class);

    @EventListener
    @CacheEvict(cacheNames = {
            LotteryDataService.CACHE_GAME_DATA,
            LotteryDataService.CACHE_CATALOG_V1,
            LotteryDataService.CACHE_CATALOG_V2,
            LotteryDataService.CACHE_STATE_GAME_NAMES,
            LotteryDataService.CACHE_STATES,
            LotteryDataService.CACHE_STATE_GAMES
    }, allEntries = true)
    public void onPollCompleted(PollCompletedEvent event) {
        log.info("Poll completed ({} succeeded, {} with rejected rows, {} failed); read caches evicted.",
                event.gamesSucceeded(), event.gamesWithRejectedRows(), event.gamesFailed());
    }
}
