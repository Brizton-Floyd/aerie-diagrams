// The type scale as the renderer draws it (docs/spec/look.md, LOOK-101 to LOOK-103 and the type
// scale): each drawn text role's face, size, colour and baseline. Sizes and faces come from the
// layout's text roles (src/layout/text/measure.ts), so drawn text is the text that was measured.
import { ROLES, faceOf, type FaceName, type RoleName } from '../layout/index.ts';
import type { Token } from './tokens.ts';

/** LOOK-101: the families, each with fallbacks used only until the bundled font loads. */
export const FAMILIES: Record<string, string> = {
  Inter: '"Inter", system-ui, sans-serif',
  'JetBrains Mono': '"JetBrains Mono", ui-monospace, monospace',
};

/** A face as a CSS font shorthand at a size. */
export function font(face: FaceName, size: number): string {
  const { family, weight, style } = faceOf(face);
  const stack = FAMILIES[family] ?? `"${family}"`;
  return `${style === 'italic' ? 'italic ' : ''}${String(weight)} ${String(size)}px ${stack}`;
}

/** How one text role is drawn. */
export interface DrawnRole {
  /** The class its text elements carry. */
  className: string;
  face: FaceName;
  size: number;
  colour: Token;
  /**
   * The baseline below the top of the role's line (LOOK-201: 14 for the name and tagline lines;
   * the chip's taller line keeps its text centred the same way).
   */
  baseline: number;
}

/** The text roles the layout places, as drawn. */
export const DRAWN: Record<RoleName, DrawnRole> = {
  name: {
    className: 't-name',
    face: ROLES.name.face,
    size: ROLES.name.size,
    colour: 'ink',
    baseline: 14,
  },
  tagline: {
    className: 't-tagline',
    face: ROLES.tagline.face,
    size: ROLES.tagline.size,
    colour: 'muted',
    baseline: 14,
  },
  taglineCode: {
    className: 't-tagline-code',
    face: ROLES.taglineCode.face,
    size: ROLES.taglineCode.size,
    colour: 'muted',
    baseline: 14,
  },
  chip: {
    className: 't-chip',
    face: ROLES.chip.face,
    size: ROLES.chip.size,
    colour: 'accent-ink',
    baseline: 15,
  },
  label: {
    className: 't-label',
    face: ROLES.label.face,
    size: ROLES.label.size,
    colour: 'muted',
    baseline: 14,
  },
  labelCode: {
    className: 't-label-code',
    face: ROLES.labelCode.face,
    size: ROLES.labelCode.size,
    colour: 'muted',
    baseline: 14,
  },
  band: {
    className: 't-band',
    face: ROLES.band.face,
    size: ROLES.band.size,
    colour: 'ink',
    baseline: 14,
  },
};

/**
 * The step badge number (LOOK-704 and the type scale): the only text smaller than 13.5 px
 * (LOOK-103), 11 px and 13 px when current, centred on the badge.
 */
export const BADGE_TEXT = {
  className: 't-badge',
  /** Not measured, so not one of the layout's faces: always one or two figures on a circle. */
  family: 'Inter',
  weight: 600,
  size: 11,
  currentSize: 13,
  colour: 'accent-ink',
  currentColour: 'on-accent',
  /** From the badge's centre down to the baseline, so the figures sit centred. */
  baseline: 4,
  currentBaseline: 4.5,
} as const;
