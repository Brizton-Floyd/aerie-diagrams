// The printer: writes a canonical model as Lines, for tools that make models
// (docs/spec/language.md, LANG-937 and LANG-941). Its output is already formatted.
import type {
  CodeUnit,
  DriftEnd,
  DriftSubject,
  Element,
  Model,
  Prose,
  ShowItem,
  WalkStep,
  Words,
} from './model.ts';
import { encodeWords } from './text.ts';

const INDENT = '  ';

/** Prints a model as Lines (LANG-937). */
export function print(model: Model): string {
  const audiences = model.audiences.map((audience) => audience.id);
  const blocks: string[][] = [];

  /** Descriptions, then each audience's `@level:`, `@level >` and `@level >>` lines. */
  const wording = (
    depth: number,
    about: Prose,
    reword: (audience: string) => string | null,
  ): string[] => {
    const pad = INDENT.repeat(depth);
    const lines = paragraphs(about.base).map((text) => `${pad}> ${text}`);
    for (const audience of audiences) {
      const line = reword(audience);
      if (line !== null) lines.push(`${pad}@${audience}: ${line}`);
      for (const text of paragraphs(about.set[audience] ?? null)) {
        lines.push(`${pad}@${audience} > ${text}`);
      }
      for (const text of paragraphs(about.add[audience] ?? null)) {
        lines.push(`${pad}@${audience} >> ${text}`);
      }
    }
    return lines;
  };
  const rewordOf =
    (words: Words) =>
    (audience: string): string | null => {
      const text = words.set[audience];
      return text === undefined ? null : encodeWords(text);
    };

  if (model.id !== null) {
    blocks.push([
      `model ${model.id}: ${encodeWords(model.title.base ?? '')}`,
      ...wording(1, model.about, rewordOf(model.title)),
    ]);
  }
  const audienceLine = model.audiences.map((audience) => {
    const flags = [
      ...(audience.id === model.defaultAudience ? ['default'] : []),
      ...(audience.code ? ['code'] : []),
    ];
    const name = `${audience.id} "${audience.name}"`;
    return flags.length === 0 ? name : `${name} (${flags.join(', ')})`;
  });
  blocks.push([`audiences ${audienceLine.join(', ')}`]);

  if (model.system !== null) {
    blocks.push([
      'system',
      ...model.system.repos.map((path) => `${INDENT}repo ${path}`),
      ...model.system.compose.map((path) => `${INDENT}compose ${path}`),
    ]);
  }

  const element = (item: Element, depth: number): string[] => {
    const pad = INDENT.repeat(depth);
    let line = `${pad}${item.id}: ${encodeWords(item.name.base ?? '')}`;
    if (item.tagline.base !== null) line += ` | ${encodeWords(item.tagline.base)}`;
    if (item.tags.length > 0) line += ` [${item.tags.join(' ')}]`;
    const lines = [line];
    if (item.icon !== null) lines.push(`${pad}${INDENT}icon ${item.icon}`);
    if (item.code.length > 0) lines.push(`${pad}${INDENT}code ${item.code.map(unit).join(' ')}`);
    lines.push(
      ...wording(depth + 1, item.about, (audience) => {
        const name = item.name.set[audience];
        const tagline = item.tagline.set[audience];
        if (tagline === undefined) return name === undefined ? null : encodeWords(name);
        return `${name === undefined ? '' : `${encodeWords(name)} `}| ${encodeWords(tagline)}`;
      }),
    );
    for (const child of model.elements) {
      if (child.parent === item.id) lines.push(...element(child, depth + 1));
    }
    return lines;
  };
  for (const item of model.elements) {
    if (item.parent === null) blocks.push(element(item, 0));
  }

  if (model.relationships.length > 0) {
    blocks.push(
      model.relationships.flatMap((relationship) => {
        const kind = relationship.kind === 'runtime' ? '' : ` [${relationship.kind}]`;
        const verb = encodeWords(relationship.verb.base ?? '');
        return [
          `${relationship.subject} ${verb} ${relationship.object}${kind}`,
          ...wording(1, relationship.about, rewordOf(relationship.verb)),
        ];
      }),
    );
  }

  for (const view of model.views) {
    const lines = [`view ${view.id}: ${encodeWords(view.title.base ?? '')}`];
    if (view.show.length > 0) lines.push(`${INDENT}show ${view.show.map(showItem).join(', ')}`);
    if (view.kinds.length !== 1 || view.kinds[0] !== 'runtime') {
      lines.push(`${INDENT}kind ${view.kinds.join(', ')}`);
    }
    lines.push(...wording(1, view.about, rewordOf(view.title)));
    blocks.push(lines);
  }

  for (const scenario of model.scenarios) {
    const lines = [
      `scenario ${scenario.id}: ${encodeWords(scenario.title.base ?? '')}`,
      ...wording(1, scenario.about, rewordOf(scenario.title)),
    ];
    for (const step of scenario.steps) {
      lines.push(`${INDENT}${step.subject} ${encodeWords(step.verb.base ?? '')} ${step.object}`);
      lines.push(...wording(2, step.about, rewordOf(step.verb)));
    }
    blocks.push(lines);
  }

  for (const walkthrough of model.walkthroughs) {
    const lines = [
      `walkthrough ${walkthrough.id}: ${encodeWords(walkthrough.title.base ?? '')}`,
      ...wording(1, walkthrough.about, rewordOf(walkthrough.title)),
    ];
    for (const step of walkthrough.steps) {
      lines.push(...walkStep(step));
      lines.push(...wording(2, step.about, () => null));
    }
    blocks.push(lines);
  }

  if (model.ignores.length > 0) {
    blocks.push(
      model.ignores.map((ignore) => `ignore drift ${subject(ignore.subject)} - ${ignore.reason}`),
    );
  }

  return blocks.map((lines) => lines.join('\n')).join('\n\n') + '\n';
}

function unit(code: CodeUnit): string {
  return `${code.kind}:${code.name}`;
}

function end(value: DriftEnd): string {
  return 'unit' in value ? unit(value.unit) : value.element;
}

function subject(value: DriftSubject): string {
  return 'from' in value ? `${end(value.from)} to ${end(value.to)}` : end(value);
}

/** The paragraphs of one part of a description. */
function paragraphs(text: string | null): string[] {
  return text === null ? [] : text.split('\n\n');
}

function showItem(item: ShowItem): string {
  if ('tag' in item) {
    return `[${item.tag}]`;
  }
  return item.depth === 0 ? item.element : `${item.element} +${String(item.depth)}`;
}

function walkStep(step: WalkStep): string[] {
  let head = `${INDENT}step ${step.target}`;
  if (step.focus.length > 0) {
    head += `: ${step.focus.join(', ')}`;
  } else if (step.range !== null) {
    const { from, to } = step.range;
    head += from === to ? `: ${String(from)}` : `: ${String(from)}-${String(to)}`;
  }
  const lines = [head];
  const pad = INDENT.repeat(2);
  if (step.open.length > 0) lines.push(`${pad}open ${step.open.join(', ')}`);
  if (step.close.length > 0) lines.push(`${pad}close ${step.close.join(', ')}`);
  if (step.audience !== null) lines.push(`${pad}for ${step.audience}`);
  return lines;
}
