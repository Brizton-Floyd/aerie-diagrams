package com.floyd.lottoptions.core.server.adapter.pdf;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;
import java.util.Map;

/**
 * A betslip template, read from {@code /betslip/{State}/{GameName}.json}: where each number's
 * box sits on the game's scanned slip image, in that image's pixels.
 *
 * <p>Only what the renderer reads is kept. The file's other properties ({@code gameName},
 * {@code jurisdiction}, {@code imagePath}, {@code scannerMarks} and the grid configurations)
 * are ignored; the slip image is loaded by naming convention instead of {@code imagePath}.
 * Absent lists and maps read as empty.</p>
 *
 * @param mark          the size of the box stamped on each marked number
 * @param playPanels    the slip's play panels, in the order plays fill them
 * @param globalOptions the slip's global options (for example Cash and Annual)
 */
@JsonIgnoreProperties(ignoreUnknown = true)
record BetslipTemplate(Mark mark, List<PlayPanel> playPanels, List<GlobalOption> globalOptions) {

    BetslipTemplate {
        playPanels = playPanels == null ? List.of() : List.copyOf(playPanels);
        globalOptions = globalOptions == null ? List.of() : List.copyOf(globalOptions);
    }

    /**
     * The size of a stamped mark.
     *
     * @param width  in pixels
     * @param height in pixels
     */
    record Mark(int width, int height) {}

    /**
     * One play panel on the slip.
     *
     * @param panelId      the panel's letter (for example "A")
     * @param mainNumbers  each main number (for example "5") to the centre of its box
     * @param bonusNumbers each bonus number to the centre of its box; empty for a game without a
     *                     bonus ball
     */
    record PlayPanel(String panelId, Map<String, Coordinate> mainNumbers, Map<String, Coordinate> bonusNumbers) {

        PlayPanel {
            mainNumbers = mainNumbers == null ? Map.of() : Map.copyOf(mainNumbers);
            bonusNumbers = bonusNumbers == null ? Map.of() : Map.copyOf(bonusNumbers);
        }
    }

    /**
     * A pixel on the slip image.
     *
     * @param x from the left edge
     * @param y from the top edge
     */
    record Coordinate(int x, int y) {}

    /**
     * A global option's box on the slip.
     *
     * @param name   the option's name as the slip spells it, possibly with trailing blanks
     * @param x      the box's centre
     * @param y      the box's centre
     * @param width  the box's width
     * @param height the box's height
     */
    record GlobalOption(String name, double x, double y, double width, double height) {}
}
