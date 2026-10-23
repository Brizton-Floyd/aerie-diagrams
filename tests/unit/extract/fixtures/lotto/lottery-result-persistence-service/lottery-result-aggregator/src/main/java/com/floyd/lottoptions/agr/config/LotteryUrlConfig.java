package com.floyd.lottoptions.agr.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "urls")
public class LotteryUrlConfig {

    private  List<GameUrlsForState> states = new ArrayList<>();
    private  List<GameInfo> allStateGames = new ArrayList<>();

    public List<GameInfo> getAllStateGames() {
        return allStateGames;
    }

    public List<GameUrlsForState> getGameUrls() {
        return states;
    }


    public void setStates(List<GameUrlsForState> states) {
        this.states = states;
    }

    public static class GameInfo {
        private String name;
        private String url;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getUrl() {
            return url;
        }

        public void setUrl(String url) {
            this.url = url;
        }
    }


    public static class GameUrlsForState {
        private String name;
        private List<GameInfo> gameInfo;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public List<GameInfo> getGameInfo() {
            return gameInfo;
        }

        public void setGameInfo(List<GameInfo> gameInfo) {
            this.gameInfo = gameInfo;
        }
    }

}
