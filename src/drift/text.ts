// The terminal report, `aerie drift`'s default form (docs/spec/drift.md, section 7; DRIFT-505):
// drift, then likely, what is not checked, suggestions and ignore lines, each finding one sentence
// in the diagram's own names with its evidence, its suggested edit and the ignore line to use
// instead, between a header that says what was checked and a footer with the counts.
import { evidenceLine } from './links.ts';
import type { Finding, Level, Suggestion } from './findings.ts';
import {
  checkedText,
  confirmedText,
  EVIDENCE_SHOWN,
  findingsAt,
  hunkLines,
  plural,
  summarise,
  uncheckedLines,
  type Run,
} from './report.ts';

/** The width prose is wrapped to; evidence and Lines are never wrapped, so they can be copied. */
const WIDTH = 100;

/** ANSI styles, for a terminal that shows colour. */
const STYLES = {
  bold: '1',
  dim: '2',
  red: '31',
  green: '32',
  yellow: '33',
  cyan: '36',
} as const;

type Style = keyof typeof STYLES;

export interface TextOptions {
  /** Colour the report with ANSI escapes, for a terminal that shows it. */
  color?: boolean;
}

const HEADINGS: Record<Level, string> = {
  drift: 'the diagram and the code disagree: several techniques agree, or an exact check failed',
  likely: 'one technique found it, or reading the code cannot rule it out; worth a look',
};

/** DRIFT-505: the report as the terminal prints it. */
export function textReport(run: Run, options: TextOptions = {}): string {
  const paint = (style: Style, text: string): string =>
    options.color === true ? `\u001b[${STYLES[style]}m${text}\u001b[0m` : text;
  const summary = summarise(run);
  const { drift, file } = run;
  const time = run.seconds === null ? '' : ` in ${run.seconds.toFixed(1)} s`;
  const out: string[] = [
    `${paint('bold', 'aerie drift')} ${file}`,
    paint('dim', `Checked against ${checkedText(run.extraction)}${time}.`),
  ];
  const section = (heading: string, lines: string[]): void => {
    out.push('', heading, ...lines);
  };

  const edits = (lines: string[][], label: string): string[] =>
    lines.length === 0
      ? []
      : [
          `    ${paint('dim', label)}`,
          ...lines.flatMap(([place = '', ...changes]) => [
            `      ${place}`,
            ...changes.map(
              (line) => `      ${paint(line.startsWith('-') ? 'red' : 'green', line)}`,
            ),
          ]),
        ];

  const evidence = (lines: Finding['evidence']): string[] => {
    if (lines.length === 0) return [];
    const shown = lines.slice(0, EVIDENCE_SHOWN).map((each) => {
      const [place = '', ...rest] = evidenceLine(each).split('  ');
      return `      ${paint('cyan', place)}  ${rest.join('  ')}`;
    });
    const more = lines.length - EVIDENCE_SHOWN;
    return [
      `    ${paint('dim', 'Code:')}`,
      ...shown,
      ...(more > 0 ? [`      and ${String(more)} more`] : []),
    ];
  };

  /** A line of a list, after the place it is about. */
  const placed = (at: string | null, text: string): string[] => {
    const [first = '', ...rest] = wrap(text, at === null ? '  ' : `  ${at}  `, '    ');
    return [at === null ? first : `  ${paint('cyan', at)}${first.slice(at.length + 2)}`, ...rest];
  };

  const finding = (each: Finding): string[] => {
    const color = each.level === 'drift' ? 'red' : 'yellow';
    const [first = '', ...rest] = wrap(`${each.id} ${each.title}`, '', '    ');
    return [
      '',
      `${paint(color, each.id)}${first.slice(each.id.length)}`,
      ...rest,
      ...(each.diagram === null
        ? []
        : [`    ${paint('dim', 'Diagram:')} ${file}:${String(each.diagram)}`]),
      ...wrap(each.detail, '    '),
      ...evidence(each.evidence),
      ...edits(hunkLines(file, each.edits), 'Suggested edit:'),
      ...edits(hunkLines(file, each.instead), 'Or, if it is meant to differ:'),
    ];
  };

  const suggestion = (each: Suggestion): string[] => {
    const [first = '', ...rest] = wrap(`${each.id} ${each.title}`, '', '    ');
    return [
      '',
      `${paint('cyan', each.id)}${first.slice(each.id.length)}`,
      ...rest,
      ...wrap(each.detail, '    '),
      ...evidence(each.evidence),
      ...edits(hunkLines(file, each.edits), 'Suggested edit:'),
    ];
  };

  for (const level of ['drift', 'likely'] as const) {
    const found = findingsAt(drift, level);
    if (found.length === 0) continue;
    const name = level === 'drift' ? 'Drift' : 'Likely';
    section(
      paint(
        level === 'drift' ? 'red' : 'yellow',
        `${name} (${String(found.length)}): ${HEADINGS[level]}`,
      ),
      found.flatMap(finding),
    );
  }
  const unchecked = uncheckedLines(run);
  if (unchecked.length > 0) {
    section(
      paint(
        'bold',
        `Not checked (${String(unchecked.length)}): code cannot show these, or drift could not read them`,
      ),
      unchecked.flatMap(({ at, text }) => placed(at, text)),
    );
  }
  if (drift.suggestions.length > 0) {
    section(
      paint(
        'bold',
        `Suggestions (${String(drift.suggestions.length)}): pin a name match with a code line; these never fail`,
      ),
      drift.suggestions.flatMap(suggestion),
    );
  }
  if (drift.ignored.length > 0) {
    section(
      paint(
        'bold',
        `Ignored (${String(drift.ignored.length)}): differences the model marks as meant`,
      ),
      drift.ignored.flatMap((each) =>
        placed(
          each.diagram === null ? null : `${file}:${String(each.diagram)}`,
          `${each.subject} - ${each.reason} (excused ${plural(each.findings.length, 'difference')})`,
        ),
      ),
    );
  }

  const counts =
    summary.drift > 0
      ? `${String(summary.drift)} drift${summary.likely > 0 ? `, ${String(summary.likely)} likely` : ''}.`
      : summary.likely > 0
        ? `No drift, ${String(summary.likely)} likely.`
        : 'No drift.';
  const hint =
    drift.findings.length > 0
      ? ' `aerie drift --format diff` prints every suggested edit as a patch.'
      : '';
  out.push(
    '',
    `${confirmedText(summary)} by the code.`,
    paint('bold', `${counts} Exit code ${String(summary.exitCode)}.`) + hint,
  );
  return `${out.join('\n')}\n`;
}

/**
 * Prose wrapped to the report's width: the first line starts with `first`, the others with `rest`.
 * A word longer than a line is never broken.
 */
export function wrap(text: string, first: string, rest = first): string[] {
  const lines: string[] = [];
  let line = first;
  let empty = true;
  for (const word of text.split(' ')) {
    if (!empty && line.length + 1 + word.length > WIDTH) {
      lines.push(line);
      line = `${rest}${word}`;
    } else {
      line = empty ? `${line}${word}` : `${line} ${word}`;
    }
    empty = false;
  }
  lines.push(line);
  return lines;
}
