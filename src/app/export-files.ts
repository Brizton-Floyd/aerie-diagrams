// Browser encoders share the exact SVG pages shown in the preview (EXPORT-006).
import { TOKENS } from '../render/index.ts';
import inter400 from '@fontsource/inter/400.css?inline';
import inter500 from '@fontsource/inter/500.css?inline';
import inter600 from '@fontsource/inter/600.css?inline';
import inter700 from '@fontsource/inter/700.css?inline';
import mono400 from '@fontsource/jetbrains-mono/400.css?inline';
import mono500 from '@fontsource/jetbrains-mono/500.css?inline';
import { imageSize, rasterSize, type ExportPage } from '../export/index.ts';

let fonts: Promise<string> | null = null;
function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read a bundled font.'));
    };
    reader.onerror = () => {
      reject(new Error('Could not read a bundled font.'));
    };
    reader.readAsDataURL(blob);
  });
}

/** Embed the same bundled subsets as the app; an SVG image cannot fetch page-level fonts. */
export function exportFonts(): Promise<string> {
  fonts ??= (async () => {
    const css = [inter400, inter500, inter600, inter700, mono400, mono500].join('\n');
    // Production CSS may already contain inline font data URLs, including semicolons.
    const sourcePattern = /url\((['"]?)([^)]+?)\1\)\s*format\(['"]woff2['"]\)/g;
    const sources = [...css.matchAll(sourcePattern)];
    if (sources.length === 0)
      throw new Error('A bundled export font is missing. Reload and try again.');
    const replacements = await Promise.all(
      sources.map(async (match) => {
        const url = match[2];
        if (url === undefined) throw new Error('A bundled export font is missing.');
        if (url.startsWith('data:')) return match[0];
        const response = await fetch(url);
        if (!response.ok)
          throw new Error('Could not load an export font. Check the connection and try again.');
        return `url("${await dataUrl(await response.blob())}") format('woff2')`;
      }),
    );
    let index = 0;
    return (
      css
        .replace(sourcePattern, () => replacements[index++] ?? '')
        .replace(/,\s*url\([^)]+\)\s*format\(['"]woff['"]\)/g, '') +
      '\nsvg * { animation:none!important; transition:none!important; }'
    );
  })().catch((error: unknown) => {
    fonts = null;
    throw error;
  });
  return fonts;
}

export function fontPage(page: ExportPage, css: string): ExportPage {
  const at = page.svg.indexOf('>') + 1;
  return { ...page, svg: page.svg.slice(0, at) + `<style>${css}</style>` + page.svg.slice(at) };
}
export function svgBlob(page: ExportPage): Blob {
  return new Blob([page.svg], { type: 'image/svg+xml' });
}

/** PNG is one complete image; no page is silently omitted to stay within the canvas limit. */
export function stackedPage(pages: readonly ExportPage[]): ExportPage {
  const width = Math.max(...pages.map((p) => p.width));
  const height = pages.reduce((sum, p) => sum + p.height, 0);
  let y = 0;
  const content = pages
    .map((p) => {
      const markup = `<g transform="translate(${String((width - p.width) / 2)} ${String(y)})">${p.svg}</g>`;
      y += p.height;
      return markup;
    })
    .join('');
  return {
    width,
    height,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}"><rect width="100%" height="100%" fill="${TOKENS.light.surface}"/>${content}</svg>`,
  };
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null)
        reject(new Error('The image could not be encoded. Try PDF or a smaller view.'));
      else resolve(blob);
    }, 'image/png');
  });
}
async function draw(page: ExportPage): Promise<Blob> {
  const size = rasterSize(page.width, page.height);
  const url = URL.createObjectURL(svgBlob(page));
  const canvas = document.createElement('canvas');
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (context === null)
      throw new Error(
        'The browser could not prepare the image. Try again or choose a smaller view.',
      );
    context.drawImage(image, 0, 0, size.width, size.height);
    return await canvasBlob(canvas);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    URL.revokeObjectURL(url);
  }
}

export async function encodeExport(
  pages: readonly ExportPage[],
  format: 'png' | 'pdf',
): Promise<Blob> {
  if (format === 'png') {
    imageSize(pages);
    return draw(stackedPage(pages));
  }
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  // No application branding, including PDF metadata. Page images preserve the bundled typography.
  pdf.setProducer('');
  pdf.setCreator('');
  for (const page of pages) {
    const png = await draw(page);
    const image = await pdf.embedPng(await png.arrayBuffer());
    const width = page.width * 0.75;
    const height = page.height * 0.75;
    pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
  }
  const bytes = await pdf.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}
