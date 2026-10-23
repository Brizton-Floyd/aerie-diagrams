package com.floyd.lottoptions.agr.processor;

import com.floyd.lottoptions.agr.documentreaders.FileReader;
import com.floyd.lottoptions.agr.documentreaders.FileReaderFactory;
import com.floyd.lottoptions.agr.documentreaders.FileReaderType;
import com.floyd.lottoptions.agr.persistence.LotteryGameSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class LotteryHistoryProcessorFactory {

    private final FileReaderFactory fileReaderFactory;
    private final String storageBaseDir;

    public LotteryHistoryProcessorFactory(FileReaderFactory fileReaderFactory,
                                          @Value("${lottery.storage.base-dir:tmp}") String storageBaseDir) {
        this.fileReaderFactory = fileReaderFactory;
        this.storageBaseDir = storageBaseDir;
    }

    /**
     * Returns a processor for the given (already upper-cased) state name, or {@code null}
     * if the state is unknown or unsupported. Never throws on an unmodeled state.
     */
    public HistoryProcessor getLottoHistoryProcessor(String str) {
        State state = State.valueOfName(str);
        switch (state) {
            case TEXAS:
                return new TexasLotteryHistoryProcessor(getFileReader(FileReaderType.CSV, str),
                        new LotteryGameSerializer(storageBaseDir));
            case LOUISIANA:
                return new LouisianaLotteryHistoryProcessor(getFileReader(FileReaderType.PDF, str),
                        new LotteryGameSerializer(storageBaseDir));
            default:
                return null;
        }
    }

    private FileReader getFileReader(FileReaderType type,
        String stateName) {
        FileReader fileReader = this.fileReaderFactory.getFileReader(type);
        fileReader.setLottoStateName(stateName);
        return fileReader;
    }

    private enum State {

        ALABAMA("Alabama", "AL"), ALASKA("Alaska", "AK"), AMERICAN_SAMOA("American Samoa", "AS"), ARIZONA("Arizona", "AZ"), ARKANSAS(
                "Arkansas", "AR"), CALIFORNIA("California", "CA"), COLORADO("Colorado", "CO"), CONNECTICUT("Connecticut", "CT"), DELAWARE(
                "Delaware", "DE"), DISTRICT_OF_COLUMBIA("District of Columbia", "DC"), FEDERATED_STATES_OF_MICRONESIA(
                "Federated States of Micronesia", "FM"), FLORIDA("Florida", "FL"), GEORGIA("Georgia", "GA"), GUAM("Guam", "GU"), HAWAII(
                "Hawaii", "HI"), IDAHO("Idaho", "ID"), ILLINOIS("Illinois", "IL"), INDIANA("Indiana", "IN"), IOWA("Iowa", "IA"), KANSAS(
                "Kansas", "KS"), KENTUCKY("Kentucky", "KY"), LOUISIANA("Louisiana", "LA"), MAINE("Maine", "ME"), MARYLAND("Maryland", "MD"), MARSHALL_ISLANDS(
                "Marshall Islands", "MH"), MASSACHUSETTS("Massachusetts", "MA"), MICHIGAN("Michigan", "MI"), MINNESOTA("Minnesota", "MN"), MISSISSIPPI(
                "Mississippi", "MS"), MISSOURI("Missouri", "MO"), MONTANA("Montana", "MT"), NEBRASKA("Nebraska", "NE"), NEVADA("Nevada",
                "NV"), NEW_HAMPSHIRE("New Hampshire", "NH"), NEW_JERSEY("New Jersey", "NJ"), NEW_MEXICO("New Mexico", "NM"), NEW_YORK(
                "New York", "NY"), NORTH_CAROLINA("North Carolina", "NC"), NORTH_DAKOTA("North Dakota", "ND"), NORTHERN_MARIANA_ISLANDS(
                "Northern Mariana Islands", "MP"), OHIO("Ohio", "OH"), OKLAHOMA("Oklahoma", "OK"), OREGON("Oregon", "OR"), PALAU("Palau",
                "PW"), PENNSYLVANIA("Pennsylvania", "PA"), PUERTO_RICO("Puerto Rico", "PR"), RHODE_ISLAND("Rhode Island", "RI"), SOUTH_CAROLINA(
                "South Carolina", "SC"), SOUTH_DAKOTA("South Dakota", "SD"), TENNESSEE("Tennessee", "TN"), TEXAS("Texas", "TX"), UTAH(
                "Utah", "UT"), VERMONT("Vermont", "VT"), VIRGIN_ISLANDS("Virgin Islands", "VI"), VIRGINIA("Virginia", "VA"), WASHINGTON(
                "Washington", "WA"), WEST_VIRGINIA("West Virginia", "WV"), WISCONSIN("Wisconsin", "WI"), WYOMING("Wyoming", "WY"), UNKNOWN(
                "Unknown", "");

        /**
         * The state's name.
         */
        private String name;

        /**
         * The state's abbreviation.
         */
        private String abbreviation;

        /**
         * The set of states addressed by abbreviations.
         */
        private static final Map<String, State> STATES_BY_ABBR = new HashMap<String, State>();

        /* static initializer */
        static {
            for (State state : values()) {
                STATES_BY_ABBR.put(state.getAbbreviation(), state);
            }
        }

        /**
         * Constructs a new state.
         *
         * @param name the state's name.
         * @param abbreviation the state's abbreviation.
         */
        State(String name, String abbreviation) {
            this.name = name;
            this.abbreviation = abbreviation;
        }

        /**
         * Returns the state's abbreviation.
         *
         * @return the state's abbreviation.
         */
        public String getAbbreviation() {
            return abbreviation;
        }

        /**
         * Gets the enum constant with the specified abbreviation.
         *
         * @param abbr the state's abbreviation.
         * @return the enum constant with the specified abbreviation.
         */
        public static State valueOfAbbreviation(final String abbr) {
            final State state = STATES_BY_ABBR.get(abbr);
            if (state != null) {
                return state;
            } else {
                return UNKNOWN;
            }
        }

        public static State valueOfName(final String name) {
            final String enumName = name.toUpperCase().replaceAll(" ", "_");
            try {
                return valueOf(enumName);
            } catch (final IllegalArgumentException e) {
                return State.UNKNOWN;
            }
        }

        @Override
        public String toString() {
            return name;
        }
    }

}
