package com.floyd.lottoptions.core.server.adapter.pdf;

import com.floyd.lottoptions.core.domain.betslip.BetslipColorMode;
import com.floyd.lottoptions.core.domain.betslip.BetslipOrder;
import com.floyd.lottoptions.core.domain.betslip.BetslipPlay;
import com.floyd.lottoptions.core.domain.betslip.BetslipRenderer;
import com.floyd.lottoptions.core.domain.betslip.BetslipTemplateNotFoundException;
import com.floyd.lottoptions.core.domain.betslip.UnknownGlobalOptionException;
import com.floyd.lottoptions.core.server.adapter.pdf.BetslipTemplate.Coordinate;
import com.floyd.lottoptions.core.server.adapter.pdf.BetslipTemplate.GlobalOption;
import com.floyd.lottoptions.core.server.adapter.pdf.BetslipTemplate.PlayPanel;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * Prints betslips as a PDF with PDFBox.
 *
 * <p>Loads the game's template and scanned slip image from the classpath (see
 * {@link BetslipTemplates}), stamps a black box of the template's mark size on each played
 * number, bonus number and the chosen global option, one play per play panel and as many slip
 * copies as the plays fill, and lays the slips out on LETTER landscape pages, three per page,
 * with red cut lines.</p>
 *
 * <p>Holds no mutable state: every call stamps its own copies of the slip image, so calls may
 * run concurrently. Nothing is random; a bonus number is marked only when the order gives one
 * (FR-014 constraint A).</p>
 */
@Component
public final class PdfBoxBetslipRenderer implements BetslipRenderer {

    private static final Logger log = LoggerFactory.getLogger(PdfBoxBetslipRenderer.class);

    private static final float PAGE_PADDING = 20f;
    private static final float SCISSOR_LINE_SPACING = 20f;
    private static final int IMAGES_PER_PAGE = 3;

    private final BetslipTemplates templates;

    /**
     * @param jsonMapper the Boot-managed mapper, which reads the templates
     */
    public PdfBoxBetslipRenderer(JsonMapper jsonMapper) {
        this.templates = new BetslipTemplates(jsonMapper);
    }

    @Override
    public byte[] render(BetslipOrder order) {
        BetslipTemplate template = templates.template(order.game())
                .orElseThrow(() -> new BetslipTemplateNotFoundException(order.game().state(), order.game().game()));
        return render(order, template);
    }

    /**
     * Renders the order on the given template, with the game's slip image. Tests render a
     * changed template through it.
     */
    byte[] render(BetslipOrder order, BetslipTemplate template) {
        try {
            BufferedImage slipImage = templates.slipImage(order.game());
            String resolvedGlobalOption = resolveGlobalOption(template, order.globalOption());
            return assemblePdf(buildMarkedImages(order, template, slipImage, resolvedGlobalOption));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /**
     * Resolves the global option to stamp (FR-014 decision B): none when the slip has none; the
     * only one when it has one; otherwise the requested one, matched ignoring case and blanks
     * around it, or the first when none is requested.
     *
     * @return the option's name without blanks around it, or {@code null} to stamp none
     * @throws UnknownGlobalOptionException when the slip has several options and none is named
     *                                      as requested
     */
    static String resolveGlobalOption(BetslipTemplate template, Optional<String> requestedOption) {
        List<GlobalOption> options = template.globalOptions();
        if (options.isEmpty()) {
            return null;
        }
        if (options.size() == 1 || requestedOption.isEmpty() || requestedOption.get().isBlank()) {
            return options.get(0).name().trim();
        }
        String requested = requestedOption.get();
        return options.stream()
                .filter(option -> requested.trim().equalsIgnoreCase(option.name().trim()))
                .map(option -> option.name().trim())
                .findFirst()
                .orElseThrow(() -> new UnknownGlobalOptionException(requested,
                        options.stream().map(GlobalOption::name).toList()));
    }

    private List<BufferedImage> buildMarkedImages(BetslipOrder order, BetslipTemplate template,
                                                  BufferedImage slipImage, String resolvedGlobalOption) {
        int panelsPerSlip = template.playPanels().size();
        if (panelsPerSlip == 0) {
            throw new IllegalArgumentException("Template has no play panels defined.");
        }

        // One slip image per panelsPerSlip plays
        List<BufferedImage> results = new ArrayList<>();
        for (List<BetslipPlay> slipPlays : partitionList(order.plays(), panelsPerSlip)) {
            BufferedImage marked = stampSlip(slipPlays, template, slipImage, resolvedGlobalOption);
            results.add(applyColorMode(marked, order.colorMode()));
        }
        return results;
    }

    /**
     * Stamps one copy of the slip image with up to one play per panel.
     */
    private BufferedImage stampSlip(List<BetslipPlay> slipPlays, BetslipTemplate template,
                                    BufferedImage slipImage, String resolvedGlobalOption) {
        BufferedImage copy = new BufferedImage(slipImage.getWidth(), slipImage.getHeight(), slipImage.getType());
        Graphics2D g2d = copy.createGraphics();
        try {
            g2d.drawImage(slipImage, 0, 0, null);
            g2d.setColor(Color.BLACK);

            int markW = template.mark().width();
            int markH = template.mark().height();
            List<PlayPanel> panels = template.playPanels();

            for (int i = 0; i < slipPlays.size(); i++) {
                PlayPanel panel = panels.get(i);
                BetslipPlay play = slipPlays.get(i);

                for (int number : play.numbers()) {
                    Coordinate coord = panel.mainNumbers().get(String.valueOf(number));
                    if (coord != null) {
                        g2d.fillRect(coord.x() - markW / 2, coord.y() - markH / 2, markW, markH);
                    }
                }

                if (play.bonus().isPresent()) {
                    int bonus = play.bonus().getAsInt();
                    Coordinate bonusCoord = panel.bonusNumbers().get(String.valueOf(bonus));
                    if (bonusCoord != null) {
                        g2d.fillRect(bonusCoord.x() - markW / 2, bonusCoord.y() - markH / 2, markW, markH);
                        log.debug("Stamped bonus {} at panel {}", bonus, panel.panelId());
                    }
                }
            }

            // The global option, once per slip
            if (resolvedGlobalOption != null) {
                for (GlobalOption option : template.globalOptions()) {
                    if (resolvedGlobalOption.equalsIgnoreCase(option.name().trim())) {
                        int ox = (int) (option.x() - option.width() / 2);
                        int oy = (int) (option.y() - option.height() / 2);
                        g2d.fillRect(ox, oy, (int) option.width(), (int) option.height());
                        break;
                    }
                }
            }
        } finally {
            g2d.dispose();
        }
        return copy;
    }

    private static BufferedImage applyColorMode(BufferedImage source, BetslipColorMode mode) {
        if (mode == BetslipColorMode.COLOR) {
            return source;
        }
        // BLACK_AND_WHITE and SCANNER_READY both print in grayscale
        BufferedImage gray = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_BYTE_GRAY);
        Graphics2D g2d = gray.createGraphics();
        try {
            g2d.drawImage(source, 0, 0, null);
        } finally {
            g2d.dispose();
        }
        return gray;
    }

    private static byte[] assemblePdf(List<BufferedImage> markedImages) throws IOException {
        try (PDDocument document = new PDDocument();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            PDRectangle pageSize = new PDRectangle(PDRectangle.LETTER.getHeight(), PDRectangle.LETTER.getWidth());

            for (List<BufferedImage> pageImages : partitionList(markedImages, IMAGES_PER_PAGE)) {
                PDPage page = new PDPage(pageSize);
                document.addPage(page);
                try (PDPageContentStream cs = new PDPageContentStream(document, page)) {
                    renderPage(cs, pageImages, pageSize, document);
                }
            }

            document.save(out);
            return out.toByteArray();
        }
    }

    private static void renderPage(PDPageContentStream cs, List<BufferedImage> pageImages,
                                   PDRectangle pageSize, PDDocument document) throws IOException {
        // Layout calculations (mirror the Desktop client's PdfPreviewPresenter.PageLayoutParams)
        float availableWidth = pageSize.getWidth() - 2 * PAGE_PADDING
                - (pageImages.size() - 1) * SCISSOR_LINE_SPACING;
        float imageWidth = availableWidth / pageImages.size();

        BufferedImage first = pageImages.get(0);
        float aspectRatio = (float) first.getHeight() / first.getWidth();
        float imageHeight = imageWidth * aspectRatio;
        float yPos;
        if (imageHeight > pageSize.getHeight() - 2 * PAGE_PADDING) {
            imageHeight = pageSize.getHeight() - 2 * PAGE_PADDING;
            imageWidth = imageHeight / aspectRatio;
            yPos = PAGE_PADDING;
        } else {
            yPos = (pageSize.getHeight() - imageHeight) / 2;
        }

        float totalImagesWidth = pageImages.size() * imageWidth;
        float totalSpacingWidth = Math.max(0, pageImages.size() - 1) * SCISSOR_LINE_SPACING;
        float totalContentWidth = totalImagesWidth + totalSpacingWidth;
        float startX = (pageSize.getWidth() - totalContentWidth) / 2;

        // The slips
        float currentX = startX;
        for (int i = 0; i < pageImages.size(); i++) {
            PDImageXObject pdImage = toPdfImage(pageImages.get(i), document);
            cs.drawImage(pdImage, currentX, yPos, imageWidth, imageHeight);
            currentX += imageWidth;
            if (i < pageImages.size() - 1) {
                currentX += SCISSOR_LINE_SPACING;
            }
        }

        // Solid border lines
        drawSolidLine(cs, startX, PAGE_PADDING, startX, pageSize.getHeight() - PAGE_PADDING);
        drawSolidLine(cs, startX + totalContentWidth, PAGE_PADDING,
                startX + totalContentWidth, pageSize.getHeight() - PAGE_PADDING);

        // Dashed cut lines between the slips
        currentX = startX + imageWidth;
        for (int i = 0; i < pageImages.size() - 1; i++) {
            float lineX = currentX + SCISSOR_LINE_SPACING / 2;
            drawDashedLine(cs, lineX, PAGE_PADDING, lineX, pageSize.getHeight() - PAGE_PADDING);
            currentX += imageWidth + SCISSOR_LINE_SPACING;
        }
    }

    private static PDImageXObject toPdfImage(BufferedImage image, PDDocument document) throws IOException {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            ImageIO.write(image, "png", out);
            try (ByteArrayInputStream in = new ByteArrayInputStream(out.toByteArray())) {
                return PDImageXObject.createFromByteArray(document, in.readAllBytes(), "png");
            }
        }
    }

    private static void drawSolidLine(PDPageContentStream cs, float x1, float y1,
                                      float x2, float y2) throws IOException {
        cs.setLineDashPattern(new float[]{}, 0);
        cs.setStrokingColor(1.0f, 0.0f, 0.0f);
        cs.setLineWidth(1.0f);
        cs.moveTo(x1, y1);
        cs.lineTo(x2, y2);
        cs.stroke();
    }

    private static void drawDashedLine(PDPageContentStream cs, float x1, float y1,
                                       float x2, float y2) throws IOException {
        cs.setLineDashPattern(new float[]{10, 5}, 0);
        cs.setStrokingColor(1.0f, 0.0f, 0.0f);
        cs.setLineWidth(1.0f);
        cs.moveTo(x1, y1);
        cs.lineTo(x2, y2);
        cs.stroke();
        cs.setLineDashPattern(new float[]{}, 0);
    }

    private static <T> List<List<T>> partitionList(List<T> list, int size) {
        List<List<T>> partitions = new ArrayList<>();
        for (int i = 0; i < list.size(); i += size) {
            partitions.add(Collections.unmodifiableList(list.subList(i, Math.min(i + size, list.size()))));
        }
        return partitions;
    }
}
