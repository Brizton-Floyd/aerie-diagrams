// A Dockerfile's stages, as far as drift needs them (DRIFT-106): each stage's base, what it copies
// in and from where (COPY, ADD and RUN bind mounts), its ENV and its EXPOSE, with build arguments
// filled in. Parsed by `dockerfile-ast`; nothing is built or run.
import { DockerfileParser } from 'dockerfile-ast';
import { interpolate } from './interpolate.ts';

export interface Stage {
  index: number;
  /** As written, or null for a stage with no `AS` name. */
  name: string | null;
  /** The image or earlier stage it starts from, with arguments filled in. */
  base: string;
  line: number;
  copies: Copy[];
  env: { name: string; value: string; line: number }[];
  expose: { port: string; protocol: string; line: number }[];
}

export interface Copy {
  /** `--from`: a stage name or index, a named build context or an image; null for the build context. */
  from: string | null;
  /** Paths in the context or stage it copies from, as written (a glob stays a glob). */
  sources: string[];
  line: number;
}

/** Reads a Dockerfile. `args` are the build arguments Compose passes (`build.args`). */
export function readDockerfile(text: string, args: ReadonlyMap<string, string | null>): Stage[] {
  const dockerfile = DockerfileParser.parse(text);
  const lines = text.split(/\r?\n/);
  const stages: Stage[] = [];
  const globals = new Map<string, string>();
  let scope = new Map<string, string>();
  let stage: Stage | null = null;
  const fill = (value: string): string => interpolate(value, scope).text;
  for (const instruction of dockerfile.getInstructions()) {
    const keyword = instruction.getKeyword().toUpperCase();
    const line = instruction.getRange().start.line + 1;
    const words = instruction.getArguments().map((each) => each.getValue());
    if (keyword === 'FROM') {
      const base = interpolate(words[0] ?? '', globals).text;
      const named = words[1]?.toUpperCase() === 'AS' ? (words[2] ?? null) : null;
      stage = { index: stages.length, name: named, base, line, copies: [], env: [], expose: [] };
      stages.push(stage);
      scope = new Map(baseChain(stages, stage).flatMap((each) => envOf(each)));
      continue;
    }
    if (keyword === 'ARG') {
      for (const word of words) {
        const equals = word.indexOf('=');
        const name = equals < 0 ? word : word.slice(0, equals);
        const given = args.get(name);
        const known = stage === null ? undefined : globals.get(name);
        const value =
          given ?? (equals < 0 ? known : interpolate(word.slice(equals + 1), scope).text);
        const target = stage === null ? globals : scope;
        if (value !== undefined) target.set(name, value);
      }
      continue;
    }
    if (stage === null) continue;
    if (keyword === 'ENV' && 'getProperties' in instruction) {
      const properties = (
        instruction as unknown as {
          getProperties(): { getName(): string; getValue(): string | null }[];
        }
      ).getProperties();
      for (const property of properties) {
        const value = fill(property.getValue() ?? '');
        stage.env.push({ name: property.getName(), value, line });
        scope.set(property.getName(), value);
      }
    } else if (keyword === 'EXPOSE') {
      for (const word of words) {
        const [port = '', protocol = 'tcp'] = fill(word).split('/');
        if (port !== '') stage.expose.push({ port, protocol, line });
      }
    } else if (keyword === 'COPY' || keyword === 'ADD') {
      if (words[0]?.startsWith('<<')) continue;
      const from = flag(instruction, 'from');
      const paths = (words[0]?.startsWith('[') ? jsonWords(lines, instruction) : words).map(fill);
      const sources = paths
        .slice(0, -1)
        .filter((each) => !/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(each) && !each.startsWith('git@'));
      if (sources.length > 0) {
        stage.copies.push({ from: from === null ? null : fill(from), sources, line });
      }
    } else if (keyword === 'RUN') {
      for (const mount of flagsNamed(instruction, 'mount')) {
        const options = new Map(
          mount.split(',').map((option) => {
            const equals = option.indexOf('=');
            return equals < 0
              ? [option, 'true']
              : [option.slice(0, equals), option.slice(equals + 1)];
          }),
        );
        if ((options.get('type') ?? 'bind') !== 'bind') continue;
        const from = options.get('from') ?? null;
        stage.copies.push({
          from: from === null ? null : fill(from),
          sources: [fill(options.get('source') ?? options.get('src') ?? '.')],
          line,
        });
      }
    }
  }
  return stages;
}

/** The stage a name or index refers to: names are not case-sensitive. */
export function stageNamed(stages: readonly Stage[], name: string): Stage | undefined {
  if (/^\d+$/.test(name)) return stages[Number(name)];
  const lower = name.toLowerCase();
  return stages.find((each) => each.name?.toLowerCase() === lower);
}

/** The stage a stage starts from, when it starts from an earlier stage rather than an image. */
export function baseStage(stages: readonly Stage[], stage: Stage): Stage | undefined {
  const lower = stage.base.toLowerCase();
  return stages.slice(0, stage.index).find((each) => each.name?.toLowerCase() === lower);
}

/** A stage's base stages, the first first, then the stage itself: what its image is made of. */
export function baseChain(stages: readonly Stage[], stage: Stage): Stage[] {
  const chain = [stage];
  for (let at = baseStage(stages, stage); at !== undefined; at = baseStage(stages, at)) {
    chain.unshift(at);
  }
  return chain;
}

function envOf(stage: Stage): [string, string][] {
  return stage.env.map((each) => [each.name, each.value]);
}

interface Flagged {
  getFlags?(): { getName(): string; getValue(): string | null }[];
}

function flagsNamed(instruction: unknown, name: string): string[] {
  const flags = (instruction as Flagged).getFlags?.() ?? [];
  return flags
    .filter((each) => each.getName() === name)
    .map((each) => each.getValue())
    .filter((each) => each !== null);
}

function flag(instruction: unknown, name: string): string | null {
  return flagsNamed(instruction, name)[0] ?? null;
}

/** The words of an instruction written in JSON form, read from its own text. */
function jsonWords(
  lines: readonly string[],
  instruction: { getRange(): { start: { line: number }; end: { line: number } } },
): string[] {
  const { start, end } = instruction.getRange();
  const text = lines
    .slice(start.line, end.line + 1)
    .join('\n')
    .replace(/\\\r?\n/g, '');
  const open = text.indexOf('[');
  const close = text.lastIndexOf(']');
  try {
    const parsed: unknown = JSON.parse(text.slice(open, close + 1));
    return Array.isArray(parsed) ? parsed.filter((each) => typeof each === 'string') : [];
  } catch {
    return [];
  }
}
