// Fixed readable type, natural-size diagrams, and line-aware document pagination (EXPORT-005).
import {
  measure,
  wrap,
  type FaceName,
  type PictureLayout,
  type TextRole,
} from '../layout/index.ts';
import { overviewShapes, trailShapes } from '../layout/index.ts';
import type { Semantics } from '../model/index.ts';
import {
  el,
  font,
  renderPicture,
  signalStyle,
  toMarkup,
  TOKENS,
  type SvgNode,
} from '../render/index.ts';
import type { ExportDocument, ExportOptions } from './document.ts';

export interface ExportPage {
  width: number;
  height: number;
  svg: string;
}
export interface ExportPages {
  document: ExportDocument;
  pages: readonly ExportPage[];
}
export const EXPORT_LIMITS = {
  scale: 2,
  side: 8192,
  pixels: 32_000_000,
  pages: 80,
  textWidth: 920,
  textHeight: 1260,
  margin: 48,
} as const;
const M = EXPORT_LIMITS.margin;
const C = TOKENS.light;
const BODY = 16;
const LINE = 25;
const text = (
  value: string,
  x: number,
  y: number,
  size = BODY,
  face: FaceName = 'sans-400',
  muted = false,
): SvgNode =>
  el(
    'text',
    {
      x,
      y: y + size,
      fill: muted ? C.muted : C.ink,
      style: `font:${font(face, size)};font-kerning:none;font-variant-ligatures:none;white-space:pre`,
    },
    [value],
  );

function page(width: number, height: number, content: readonly SvgNode[]): ExportPage {
  return {
    width,
    height,
    svg: toMarkup(
      el(
        'svg',
        {
          xmlns: 'http://www.w3.org/2000/svg',
          width,
          height,
          viewBox: `0 0 ${String(width)} ${String(height)}`,
          'data-theme': 'light',
          'data-motion': 'reduce',
          role: 'img',
        },
        [
          el('style', {}, [signalStyle()]),
          el('rect', { width, height, fill: C.surface }),
          ...content,
        ],
      ),
    ),
  };
}

export function rasterSize(width: number, height: number): { width: number; height: number } {
  const w = Math.ceil(width * EXPORT_LIMITS.scale);
  const h = Math.ceil(height * EXPORT_LIMITS.scale);
  if (
    !Number.isFinite(w) ||
    !Number.isFinite(h) ||
    w < 1 ||
    h < 1 ||
    w > EXPORT_LIMITS.side ||
    h > EXPORT_LIMITS.side ||
    w * h > EXPORT_LIMITS.pixels
  )
    throw new Error(
      'This image is too large to export legibly. Try PDF for paginated content, or choose a smaller view.',
    );
  return { width: w, height: h };
}

export function imageSize(pages: readonly ExportPage[]): { width: number; height: number } {
  return rasterSize(
    Math.max(...pages.map((p) => p.width)),
    pages.reduce((sum, p) => sum + p.height, 0),
  );
}

/** The diagram is never scaled down; text pages use the same measured font sizes as preview. */
export function exportPages(
  semantics: Semantics,
  document: ExportDocument,
  options: ExportOptions,
  picture: PictureLayout,
): ExportPages {
  const pages: ExportPage[] = [];
  let trail: readonly import('../layout/index.ts').TrailShape[] | undefined;
  let overview: { step: number; sentences: string[]; unit: 'Stage' | 'Step' } | undefined;
  if (options.scenario !== null) {
    const staged = semantics.scenario(options.scenario).stages !== undefined;
    const steps = semantics.overviewSteps(options.scenario, options.audience);
    const path = semantics.overviewTrail(options.scenario, options.view, document.zoom);
    trail = staged ? overviewShapes(picture, path) : trailShapes(picture.result, path);
    overview = {
      step: 0,
      sentences: steps.map((s) => s.sentence),
      unit: staged ? 'Stage' : 'Step',
    };
  }
  const diagram = renderPicture(semantics, picture, {
    theme: 'light',
    ...(trail === undefined ? {} : { trail }),
    ...(overview === undefined ? {} : { overview }),
  });
  const width = Math.max(EXPORT_LIMITS.textWidth, Number(diagram.attrs['width']) + 2 * M);
  const headlineRole: TextRole = { face: 'sans-600', size: 25, line: 34, wrap: width - 2 * M };
  const headlines = wrap(document.title, headlineRole);
  const subtitle = [document.audience, document.scenario, document.about]
    .filter(Boolean)
    .join(' / ');
  const subtitles = wrap(subtitle, { face: 'sans-400', size: 14, line: 21, wrap: width - 2 * M });
  const top = M + headlines.length * 34 + subtitles.length * 21 + 28;
  const height = top + Number(diagram.attrs['height']) + M;
  rasterSize(width, height);
  diagram.attrs['x'] = M;
  diagram.attrs['y'] = top;
  const diagramContents: SvgNode[] = headlines.map((s, i) =>
    text(s.text, M, M + i * 34, 25, 'sans-600'),
  );
  subtitles.forEach((s, i) =>
    diagramContents.push(text(s.text, M, M + headlines.length * 34 + i * 21, 14, 'sans-400', true)),
  );
  diagramContents.push(diagram);
  pages.push(page(width, height, diagramContents));

  let content: SvgNode[] = [];
  let y = M;
  const finish = (): void => {
    if (content.length === 0) return;
    if (pages.length >= EXPORT_LIMITS.pages)
      throw new Error(
        'This document exceeds the supported 80-page limit. Turn off the component reference or choose a smaller view.',
      );
    pages.push(page(EXPORT_LIMITS.textWidth, EXPORT_LIMITS.textHeight, content));
    content = [];
    y = M;
  };
  const ensure = (needed: number): void => {
    if (y + needed > EXPORT_LIMITS.textHeight - M) finish();
  };
  for (let index = 0; index < document.blocks.length; index++) {
    const block = document.blocks[index];
    if (block === undefined) continue;
    if (block.kind === 'section') finish();
    const heading = block.kind !== 'paragraph';
    const size = block.kind === 'section' ? 24 : block.kind === 'heading' ? 20 : BODY;
    const face: FaceName = heading ? 'sans-600' : document.code ? 'mono-400' : 'sans-400';
    const role: TextRole = {
      face,
      size,
      line: heading ? size + 10 : LINE,
      wrap: EXPORT_LIMITS.textWidth - 2 * M,
    };
    const paragraphs = block.text.split(/\n\s*\n/);
    if (heading) {
      const count = paragraphs.reduce((sum, p) => sum + wrap(p, role).length, 0);
      // A complete step sentence is content too; do not reserve every following label.
      const next = document.blocks[index + 1];
      const following = next !== undefined && next.kind !== 'section' ? LINE + 22 : 0;
      ensure(Math.min(count * role.line + 16 + following, EXPORT_LIMITS.textHeight - 2 * M));
    }
    for (const paragraph of paragraphs) {
      for (const line of wrap(paragraph, role)) {
        ensure(role.line);
        if (measure(line.text, role) > (role.wrap ?? 0))
          throw new Error(
            'A label cannot fit at a readable size. Choose a different view or shorten the text.',
          );
        content.push(text(line.text, M, y, size, face));
        y += role.line;
      }
      y += 10;
    }
    y += heading ? 8 : 4;
  }
  finish();
  return { document, pages };
}
