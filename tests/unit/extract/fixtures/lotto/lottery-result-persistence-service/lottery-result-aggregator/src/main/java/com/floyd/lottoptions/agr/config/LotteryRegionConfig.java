package com.floyd.lottoptions.agr.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "us.state")
public class LotteryRegionConfig {
    private final List<String> regions = new ArrayList<String>();
    public List<String> getRegions() {
        return this.regions;
    }
}
