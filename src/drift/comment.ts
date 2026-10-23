// `aerie drift --format pr` (docs/spec/drift.md, section 7; DRIFT-508): the body of the one sticky
// pull request comment per model file, found again by its hidden marker: a status dot and one
// summary sentence, a table of findings, each finding folded with its evidence, its edit as a
// `diff` block and the ignore line to use instead, then what is not checked, the suggestions and
// the ignore lines.
import { evidenceLine } from './links.ts';
import type { Finding } from './findings.ts';
import { diffHunks } from './patch.ts';
import {
  confirmedText,
  EVIDENCE_SHOWN,
  plural,
  summarise,
  uncheckedLines,
  type Run,
} from './report.ts';

/** DRIFT-508: the hidden marker that finds a model file's comment again. */
export function commentMarker(file: string): string {
  return `<!-- aerie-drift: ${file} -->`;
}

const DOTS = { drift: '🔴', likely: '🟡', clean: '🟢' } as const;

/** Text with `&`, `<` and `>` escaped, so GitHub shows what the code says rather than HTML. */
function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Text for an HTML `<summary>`, where Markdown is not read: `` `code` `` as `<code>`. */
function html(text: string): string {
  return escape(text).replace(/`([^`]+)`/g, '<code>$1</code>');
}

/** Text for a table cell, where `|` ends the cell and a line break the row. */
function cell(text: string): string {
  return escape(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/** A fence longer than any run of backticks in the text, so the text cannot close it. */
function fence(lines: readonly string[], language = ''): string[] {
  const longest = Math.max(
    2,
    ...lines.map((line) => Math.max(0, ...(line.match(/`+/g) ?? []).map((run) => run.length))),
  );
  const ticks = '`'.repeat(longest + 1);
  return [`${ticks}${language}`, ...lines, ticks];
}

/** DRIFT-508: the comment's Markdown. */
export function prComment(run: Run): string {
  const summary = summarise(run);
  const { drift, file, source } = run;
  const dot = summary.drift > 0 ? DOTS.drift : summary.likely > 0 ? DOTS.likely : DOTS.clean;
  const repos = run.extraction.repos.map((repo) => `\`${repo.name}\``).join(', ');
  // The levels that fail the check: drift, and likely too with `--fail-on likely`.
  const fails = (level: 'drift' | 'likely'): boolean =>
    level === 'drift' || run.failOn === 'likely';
  const counts = (['drift', 'likely'] as const).flatMap((level) =>
    summary[level] > 0
      ? [`**${String(summary[level])} ${level}**${fails(level) ? ' (fails this check)' : ''}`]
      : [],
  );
  const unchecked = uncheckedLines(run);
  const others = [
    `${String(unchecked.length)} not checked`,
    ...(drift.suggestions.length > 0 ? [plural(drift.suggestions.length, 'suggestion')] : []),
    ...(drift.ignored.length > 0 ? [`${String(drift.ignored.length)} ignored`] : []),
  ];
  const sentence =
    counts.length === 0
      ? `No drift. ${others.join(', ')}.`
      : `${[...counts, ...others].join(', ')}.`;
  const out: string[] = [
    commentMarker(file),
    `### ${dot} Aerie drift: \`${file}\``,
    '',
    `${sentence} ${confirmedText(summary)} against ${repos}.`,
  ];

  if (drift.findings.length > 0) {
    out.push('', '| | Finding | Diagram |', '| --- | --- | --- |');
    for (const each of drift.findings) {
      const where = each.diagram === null ? 'not drawn' : `\`${file}:${String(each.diagram)}\``;
      out.push(`| ${DOTS[each.level]} ${each.id} | ${cell(each.title)} | ${where} |`);
    }
    for (const each of drift.findings) out.push('', ...folded(each));
  }

  const rest: string[] = [
    ...unchecked.map(({ at, text }) => `- ${at === null ? '' : `\`${at}\` `}${escape(text)}`),
    ...drift.suggestions.flatMap((each) => [
      `- Suggestion ${each.id}: ${escape(each.title)} ${escape(each.detail)}`,
      '',
      ...fence(diffHunks(source, each.edits).trimEnd().split('\n'), 'diff').map((line) =>
        line === '' ? '' : `  ${line}`,
      ),
    ]),
    ...drift.ignored.map(
      (each) =>
        `- Ignored \`${each.subject}\`${each.diagram === null ? '' : ` (\`${file}:${String(each.diagram)}\`)`}: ${escape(each.reason)} (excused ${plural(each.findings.length, 'difference')})`,
    ),
  ];
  if (rest.length > 0) {
    const heading = [
      `Not checked (${String(unchecked.length)})`,
      `suggestions (${String(drift.suggestions.length)})`,
      `ignored (${String(drift.ignored.length)})`,
    ].join(', ');
    out.push('', `<details><summary>${heading}</summary>`, '', ...rest, '', '</details>');
  }

  out.push(
    '',
    `Run \`npx aerie drift ${file}\` locally, or add \`--format diff\` for every suggested edit as a patch. Aerie never edits the diagram itself.`,
  );
  return `${out.join('\n')}\n`;

  function folded(each: Finding): string[] {
    const shown = each.evidence.slice(0, EVIDENCE_SHOWN);
    const more = each.evidence.length - shown.length;
    const edit = diffHunks(source, each.edits).trimEnd();
    const instead = each.instead.flatMap((hunk) => hunk.add).filter((line) => line !== '');
    return [
      `<details><summary><b>${each.id}</b> ${html(each.title)}</summary>`,
      '',
      ...(each.diagram === null ? [] : [`Diagram: \`${file}:${String(each.diagram)}\``, '']),
      escape(each.detail),
      ...(shown.length === 0
        ? []
        : [
            '',
            'Evidence:',
            '',
            ...shown.map((line) => {
              const [place = '', ...rest] = evidenceLine(line).split('  ');
              return `- \`${place}\` ${escape(rest.join('  '))}`;
            }),
            ...(more > 0 ? [`- and ${String(more)} more`] : []),
          ]),
      ...(edit === '' ? [] : ['', 'Suggested edit:', '', ...fence(edit.split('\n'), 'diff')]),
      ...(instead.length === 0 ? [] : ['', 'Or, if it is meant to differ:', '', ...fence(instead)]),
      '',
      '</details>',
    ];
  }
}
