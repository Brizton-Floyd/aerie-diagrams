package com.floyd.lottoptions.core.server.adapter.pdf;

import com.floyd.lottoptions.core.domain.game.GameId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.util.Optional;

/**
 * Reads a game's betslip template and scanned slip image from the classpath, under
 * {@code /betslip/{State}/{GameName}}, the game's name without blanks (for example
 * {@code /betslip/Texas/CashFive.json}).
 */
final class BetslipTemplates {

    private static final Logger log = LoggerFactory.getLogger(BetslipTemplates.class);

    private static final String[] IMAGE_EXTENSIONS = {"jpg", "jpeg", "png"};

    private final JsonMapper jsonMapper;

    BetslipTemplates(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    /**
     * Loads the game's template.
     *
     * @return the template, or empty when there is none or it cannot be read
     */
    Optional<BetslipTemplate> template(GameId game) {
        String resourcePath = resourcePath(game, "json");
        try (InputStream is = getClass().getResourceAsStream(resourcePath)) {
            if (is == null) {
                log.debug("No template resource at {}", resourcePath);
                return Optional.empty();
            }
            return Optional.of(jsonMapper.readValue(is, BetslipTemplate.class));
        } catch (IOException | JacksonException e) {
            log.error("Failed to parse template resource: {}", resourcePath, e);
            return Optional.empty();
        }
    }

    /**
     * Loads the game's scanned slip image, the first of a {@code .jpg}, {@code .jpeg} or
     * {@code .png}.
     *
     * @throws IOException when there is none or it cannot be read
     */
    BufferedImage slipImage(GameId game) throws IOException {
        for (String extension : IMAGE_EXTENSIONS) {
            try (InputStream is = getClass().getResourceAsStream(resourcePath(game, extension))) {
                if (is != null) {
                    BufferedImage image = ImageIO.read(is);
                    if (image != null) {
                        return image;
                    }
                }
            }
        }
        throw new IOException("Base image not found for " + game.state() + " / " + game.game());
    }

    private static String resourcePath(GameId game, String extension) {
        return "/betslip/" + game.state() + "/" + game.game().replaceAll("\\s+", "") + "." + extension;
    }
}
