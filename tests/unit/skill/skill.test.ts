// The Aerie skill for Claude (docs/spec/claude-skill.md): its files, every Lines example in it run
// through the real `aerie` command, its summary of the language against the parser, and the
// commands its workflow runs, the drift loop of worked example 1 included.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, normalize, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOGUE, ICON_NAMES, KEYWORDS, parse, type Model } from '../../../src/lines/index.ts';
import { check } from '../../../src/model/index.ts';
import type { DriftDocument, FindingKind } from '../../../src/drift/index.ts';

const ROOT = join(import.meta.dirname, '../../..');
const SKILL = join(ROOT, 'skills/aerie');
const CLI = join(ROOT, 'src/cli/aerie.ts');

const read = (path: string): string => readFileSync(join(SKILL, path), 'utf8');

/** Every file in the skill, as a path relative to the skill folder. */
function skillFiles(dir = SKILL): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? skillFiles(join(dir, entry.name))
      : [relative(SKILL, join(dir, entry.name))],
  );
}

const markdown = skillFiles().filter((path) => path.endsWith('.md'));
const exampleFiles = skillFiles().filter((path) => path.endsWith('.aerie'));
const WORKED = ['examples/recipe-box/architecture.aerie', 'examples/parcel-tracker.aerie'];

/** Every ```aerie block in the skill's Markdown, with where it is. */
const blocks = markdown.flatMap((path) =>
  [...read(path).matchAll(/^```aerie\n([\s\S]*?)^```$/gm)].map((match, index) => ({
    name: `${path}#${String(index + 1)}`,
    source: match[1] ?? '',
  })),
);

/** Runs the real `aerie` command, as the skill does. */
function aerie(args: string[], cwd = ROOT): { status: number | null; out: string; err: string } {
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
  return { status: result.status, out: result.stdout, err: result.stderr };
}

interface CheckJson {
  files: {
    path: string;
    diagnostics: {
      id: string;
      severity: string;
      line: number;
      column: number;
      endLine: number;
      endColumn: number;
      message: string;
    }[];
  }[];
  errors: number;
  warnings: number;
}

function modelOf(path: string): Model {
  const { model, diagnostics } = check(read(path));
  expect(diagnostics).toEqual([]);
  if (model === null) throw new Error(`${path} has no model`);
  return model;
}

/** The rows of the first Markdown table after `heading`, as trimmed cells, without the header. */
function tableAfter(text: string, heading: string): string[][] {
  const start = text.indexOf(heading);
  expect(start, heading).toBeGreaterThanOrEqual(0);
  const lines = text.slice(start).split('\n');
  const first = lines.findIndex((line) => line.trimStart().startsWith('|'));
  const rows: string[][] = [];
  for (const line of lines.slice(first)) {
    if (!line.trimStart().startsWith('|')) break;
    const cells = line
      .trim()
      .slice(1, -1)
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim());
    if (cells.every((cell) => /^-+$/.test(cell))) continue;
    rows.push(cells);
  }
  return rows.slice(1);
}

describe('SCOPE-009 the skill is self-contained and well formed', () => {
  it('SKILL-001 SKILL.md names the skill aerie and says when to use it', () => {
    const front = /^---\n([\s\S]*?)\n---\n/.exec(read('SKILL.md'))?.[1] ?? '';
    expect(front).toMatch(/^name: aerie$/m);
    const description = /^description: (.+)$/m.exec(front)?.[1] ?? '';
    expect(description).toContain('Aerie diagram');
    expect(description).toContain('`.aerie` file');
    expect(description).toMatch(/write, update or fix/);
    expect(description).toMatch(/architecture to readers at different levels/);
    expect(description).toMatch(/keep it in step with the code/);
  });

  it('SKILL-002 has its reference files and examples beside SKILL.md', () => {
    for (const path of ['SKILL.md', 'reference/lines.md', 'reference/wording.md']) {
      expect(existsSync(join(SKILL, path)), path).toBe(true);
    }
    expect(exampleFiles.length).toBeGreaterThanOrEqual(5);
    for (const path of exampleFiles) {
      expect(read('SKILL.md'), path).toContain(`](${path})`);
    }
  });

  it('SKILL-003 SKILL-006 links only to its own files, and runs Aerie without reading its code', () => {
    for (const path of markdown) {
      for (const match of read(path).matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
        const target = match[1] ?? '';
        if (/^[a-z]+:/.test(target)) continue;
        const resolved = normalize(join(dirname(path), target));
        expect(resolved.startsWith('..'), `${path} links outside the skill: ${target}`).toBe(false);
        expect(existsSync(join(SKILL, resolved)), `${path} links to ${target}`).toBe(true);
      }
      // The only path into an Aerie checkout the skill names is the command it runs.
      const paths = [...read(path).matchAll(/<checkout>\/[\w./-]*/g)].map((found) => found[0]);
      expect(new Set(paths), path).toEqual(
        new Set(paths.length > 0 ? ['<checkout>/src/cli/aerie.ts'] : []),
      );
    }
  });

  it('SKILL-004 every example file passes aerie check cleanly and is formatted', () => {
    const files = exampleFiles.map((path) => join('skills/aerie', path));
    const checked = aerie(['check', '--format', 'json', ...files]);
    expect(checked.status).toBe(0);
    const json = JSON.parse(checked.out) as CheckJson;
    expect(json.files.map((file) => [file.path, file.diagnostics])).toEqual(
      files.map((path) => [path, []]),
    );
    expect(aerie(['format', '--check', ...files])).toEqual({ status: 0, out: '', err: '' });
  });

  it.each(blocks.map((block) => [block.name, block.source]))(
    'SKILL-004 the example %s passes aerie check cleanly and is formatted',
    (_name, source) => {
      const dir = mkdtempSync(join(tmpdir(), 'aerie-skill-'));
      writeFileSync(join(dir, 'example.aerie'), source);
      expect(aerie(['check', 'example.aerie'], dir)).toEqual({
        status: 0,
        out: 'No problems found.\n',
        err: '',
      });
      expect(aerie(['format', '--check', 'example.aerie'], dir).status).toBe(0);
    },
  );

  it('SKILL-005 uses Aerie words and names no other diagram tool', () => {
    for (const path of skillFiles()) {
      const text = read(path);
      expect(text, path).not.toMatch(
        /\b(?:ilograph|mermaid|plantuml|structurizr|graphviz|draw\.io|lucidchart|excalidraw|C4)\b/i,
      );
      expect(text, path).not.toMatch(/\b(?:resources?|perspectives?|sequences?|detail levels?)\b/i);
    }
  });
});

describe("the skill's summary of the language matches the parser", () => {
  const lines = read('reference/lines.md');

  it('SKILL-101 lists exactly the keywords of the parser', () => {
    const listed = /The keywords, all of them: (.*?)\. None/s.exec(lines)?.[1] ?? '';
    expect([...listed.matchAll(/`([a-z]+)`/g)].map((found) => found[1])).toEqual([...KEYWORDS]);
  });

  it('SKILL-101 lists the line kinds in the order the parser tries them', () => {
    const kinds = tableAfter(lines, 'The first characters of a statement').map((row) => row[1]);
    expect(kinds).toEqual(['rewording', 'description', 'keyword line', 'element', 'sentence']);
  });

  it('SKILL-101 gives the same ownership table as the language spec', () => {
    const spec = readFileSync(join(ROOT, 'docs/spec/language.md'), 'utf8');
    expect(tableAfter(lines, '**What may go inside what.**')).toEqual(
      tableAfter(spec, '**LANG-006**'),
    );
  });

  it('SKILL-103 lists exactly the icons of the parser', () => {
    const listed = /The names: (.*?)\. Without/s.exec(lines)?.[1] ?? '';
    expect([...listed.matchAll(/`([a-z]+)`/g)].map((found) => found[1])).toEqual([...ICON_NAMES]);
  });

  it('SKILL-101 states the default audiences exactly as the parser has them', () => {
    const line = /model has exactly\s+`([^`]+)`/.exec(lines)?.[1] ?? '';
    const written = parse(`audiences ${line}\nweb: Web\n`).model;
    const unwritten = parse('web: Web\n').model;
    expect(written?.audiences).toEqual(unwritten?.audiences);
    expect(written?.defaultAudience).toBe(unwritten?.defaultAudience);
  });

  it('SKILL-206 gives the usual cause and fix of every diagnostic in the catalogue', () => {
    const ids = tableAfter(lines, '## Fixing diagnostics').map((row) => row[0]);
    expect([...ids].sort()).toEqual(Object.keys(CATALOGUE).sort());
  });
});

describe('the worked examples follow the skill', () => {
  it.each(WORKED)(
    'SKILL-102 SKILL-103 %s takes ids from the project and tags every element',
    (path) => {
      const model = modelOf(path);
      const depth = (id: string | null): number =>
        id === null
          ? 0
          : 1 + depth(model.elements.find((element) => element.id === id)?.parent ?? null);
      for (const element of model.elements) {
        expect(element.id).not.toMatch(/^(?:component|element|node|service|box|thing)-?\d+$/);
        expect(element.tags.length, element.id).toBeGreaterThan(0);
        if (element.tags.includes('person') || element.tags.includes('external')) {
          expect(element.parent, element.id).toBeNull();
        }
      }
      const levels = Math.max(...model.elements.map((element) => depth(element.parent) + 1));
      expect(levels).toBeGreaterThanOrEqual(2);
      expect(levels).toBeLessThanOrEqual(4);
    },
  );

  it.each(WORKED)('SKILL-104 %s writes plain lower-case verbs, runtime or code', (path) => {
    for (const relationship of modelOf(path).relationships) {
      expect(relationship.verb.base).toMatch(/^[a-z]/);
      expect(['runtime', 'code']).toContain(relationship.kind);
    }
  });

  it.each(WORKED)(
    'SKILL-105 %s keeps executive wording sparse and adds engineer detail',
    (path) => {
      const model = modelOf(path);
      const words = [
        model.title,
        ...model.elements.flatMap((element) => [element.name, element.tagline]),
        ...model.relationships.map((relationship) => relationship.verb),
      ];
      const prose = [model.about, ...model.elements.map((element) => element.about)];
      const exec =
        words.filter((w) => 'exec' in w.set).length + prose.filter((p) => 'exec' in p.set).length;
      const engineer =
        words.filter((w) => 'engineer' in w.set).length +
        prose.filter((p) => 'engineer' in p.add).length;
      expect(exec).toBeGreaterThan(0);
      expect(engineer).toBeGreaterThan(2 * exec);
      expect(model.elements.some((element) => 'manager' in element.name.set)).toBe(false);
    },
  );

  it.each(WORKED)(
    'SKILL-106 SKILL-107 SKILL-108 %s has the views, scenarios and tour the skill asks for',
    (path) => {
      const model = modelOf(path);
      expect(model.views.length).toBeGreaterThanOrEqual(2);
      expect(model.views.length).toBeLessThanOrEqual(4);
      const system = model.elements.find((element) => element.tags.includes('system'));
      expect(model.views[0]?.show).toContainEqual({ element: system?.id, depth: 1 });
      expect(model.scenarios.length).toBeGreaterThanOrEqual(1);
      expect(model.scenarios.length).toBeLessThanOrEqual(3);
      expect(model.walkthroughs).toHaveLength(1);
      expect(model.walkthroughs[0]?.steps.length).toBeGreaterThanOrEqual(5);
      expect(model.walkthroughs[0]?.steps.length).toBeLessThanOrEqual(9);
    },
  );

  it.each(WORKED)(
    'SKILL-203 SKILL-204 %s marks what it could not confirm and keeps the order',
    (path) => {
      const source = read(path);
      expect(source).toMatch(/^\/\/ Unsure: /m);
      const first = (pattern: RegExp): number =>
        source.split('\n').findIndex((line) => pattern.test(line));
      const order = [
        first(/^model /),
        first(/^audiences /),
        first(/^[a-z][a-z0-9-]*:/),
        first(/^(?!(?:model|audiences|view|scenario|walkthrough) )[a-z][a-z0-9-]* [^:]*$/),
        first(/^view /),
        first(/^scenario /),
        first(/^walkthrough /),
      ];
      expect(order.every((line) => line >= 0)).toBe(true);
      // The system root and ignore lines, where a model has them, go after the audiences and last.
      const system = first(/^system$/);
      const ignore = first(/^ignore drift /);
      if (system >= 0) order.splice(2, 0, system);
      if (ignore >= 0) order.push(ignore);
      expect(order).toEqual([...order].sort((a, b) => a - b));
    },
  );
});

describe('the commands the skill runs', () => {
  const skill = read('SKILL.md');

  it('SKILL-205 SKILL-208 SKILL-212 names only commands the aerie help lists, apart from watch', () => {
    const help = aerie(['--help']);
    expect(help.status).toBe(0);
    expect(help.out).toMatch(/^Usage:/);
    const named = new Set([...skill.matchAll(/`aerie (\w+)/g)].map((found) => found[1] ?? ''));
    expect([...named].sort()).toEqual(['check', 'drift', 'format', 'model', 'watch']);
    for (const command of ['check', 'format', 'model', 'drift']) {
      expect(help.out).toContain(`aerie ${command} <file>`);
    }
  });

  it('SKILL-205 SKILL-206 SKILL-207 the worked example rounds are what aerie check prints', () => {
    // Round 1 of examples/recipe-box.md: the finished file with the three first-draft mistakes.
    const draft = read('examples/recipe-box/architecture.aerie')
      .replace(
        '  cook asks for the shopping list from web\n',
        '  cook asks web for the shopping list\n',
      )
      .replace('  show cook, recipe-box +1, mail\n', '  show cook, recipe-box +1, mial\n')
      .replace(
        '  mailer sends the shopping list through mail\n',
        '  planner sends the shopping list through mail\n',
      );
    const dir = mkdtempSync(join(tmpdir(), 'aerie-skill-'));
    writeFileSync(join(dir, 'architecture.aerie'), draft);

    const json = aerie(['check', 'architecture.aerie', '--format', 'json'], dir);
    expect(json.status).toBe(1);
    const result = JSON.parse(json.out) as CheckJson;
    expect(result.errors).toBe(2);
    expect(result.warnings).toBe(1);
    expect(result.files[0]?.diagnostics.map((found) => found.id)).toEqual(['E008', 'E401', 'W601']);
    expect(Object.keys(result.files[0]?.diagnostics[0] ?? {})).toEqual([
      'id',
      'severity',
      'line',
      'column',
      'endLine',
      'endColumn',
      'message',
    ]);

    const text = aerie(['check', 'architecture.aerie'], dir);
    const shown = /\*\*Round 1\.\*\*[\s\S]*?```text\n([\s\S]*?)```/.exec(
      read('examples/recipe-box.md'),
    );
    expect(text.out).toBe(shown?.[1]);

    writeFileSync(join(dir, 'architecture.aerie'), read('examples/recipe-box/architecture.aerie'));
    expect(aerie(['check', 'architecture.aerie', '--format', 'json'], dir).status).toBe(0);
    expect(aerie(['check', 'architecture.aerie'], dir).out).toBe('No problems found.\n');
  });

  it('SKILL-208 aerie format puts a messy file back in shape, and changes nothing after', () => {
    const tidy = read('examples/first-file.aerie');
    const dir = mkdtempSync(join(tmpdir(), 'aerie-skill-'));
    writeFileSync(
      join(dir, 'architecture.aerie'),
      tidy.replace(/\n\n/g, '\n\n\n').replace(/ \| /g, '   |  '),
    );
    expect(aerie(['format', 'architecture.aerie', '--check'], dir).status).toBe(1);
    expect(aerie(['format', 'architecture.aerie'], dir).status).toBe(0);
    expect(readFileSync(join(dir, 'architecture.aerie'), 'utf8')).toBe(tidy);
    expect(aerie(['format', 'architecture.aerie', '--check'], dir).status).toBe(0);
  });
});

describe('the dry run recorded in docs/skill-dry-runs', () => {
  it('SKILL-004 the model the skill drafted still passes aerie check cleanly and is formatted', () => {
    const file = 'docs/skill-dry-runs/voting-app.aerie';
    expect(aerie(['check', file])).toEqual({ status: 0, out: 'No problems found.\n', err: '' });
    expect(aerie(['format', '--check', file]).status).toBe(0);
  });
});

describe('SKILL-302 the drift loop of worked example 1', () => {
  const guide = read('examples/recipe-box.md');
  const finished = read('examples/recipe-box/architecture.aerie');
  // The first draft: the finished file without the ignore line drift's first round led to.
  const draft = finished.replace(/\n\n\/\/ -+ drift\n\nignore drift .*\n$/, '\n');

  /** The code block after `label` in the worked example. */
  function shown(label: string, fence: 'text' | 'diff'): string {
    const at = guide.indexOf(label);
    expect(at, label).toBeGreaterThanOrEqual(0);
    return new RegExp(`\`\`\`${fence}\\n([\\s\\S]*?)\`\`\``).exec(guide.slice(at))?.[1] ?? '';
  }

  /** The example project in a folder of its own, with the model as `source`. */
  function project(source: string): string {
    const dir = join(mkdtempSync(join(tmpdir(), 'aerie-skill-')), 'recipe-box');
    cpSync(join(SKILL, 'examples/recipe-box'), dir, { recursive: true });
    writeFileSync(join(dir, 'architecture.aerie'), source);
    return dir;
  }

  /** `aerie drift`, as the skill runs it from the folder that holds the model. */
  function drift(dir: string, ...args: string[]): { status: number | null; out: string } {
    const { status, out } = aerie(['drift', 'architecture.aerie', ...args], dir);
    return { status, out: out.replace(/ in \d+\.\d s\.$/m, ' in 0.0 s.') };
  }
  const json = (dir: string): DriftDocument =>
    JSON.parse(drift(dir, '--format', 'json').out) as DriftDocument;
  const footer = (text: string): string => text.split('\n').slice(-3).join('\n');

  /** Applies a patch the worked example shows, with git, in the project's folder. */
  function apply(dir: string, patch: string): void {
    const result = spawnSync('git', ['apply', '-'], {
      cwd: dir,
      input: patch,
      encoding: 'utf8',
      env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(dir) },
    });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  }

  it('SKILL-211 the finished model has a system root and a code line for each part drift reads', () => {
    const model = modelOf('examples/recipe-box/architecture.aerie');
    expect(model.system).toMatchObject({ repos: ['.'], compose: ['compose.yaml'] });
    const coded = model.elements.filter((element) => element.code.length > 0);
    expect(coded.map((element) => element.id)).toEqual(['web', 'api', 'db']);
    const document = json(project(finished));
    expect(document.suggestions).toEqual([]);
    expect(document.confirmed.map((each) => each.subject)).toEqual(
      expect.arrayContaining(coded.map((element) => ({ element: element.id }))),
    );
  });

  it('SKILL-212 round 1 finds the left-out service, as the worked example and the reference show it', () => {
    const dir = project(draft);
    const text = drift(dir);
    expect(text.status).toBe(1);
    expect(text.out).toBe(shown('**Drift round 1.**', 'text'));
    const document = json(dir);
    expect(document.summary).toMatchObject({ drift: 1, likely: 0, exitCode: 1 });
    // The reference's sample finding is this one, exactly.
    const sample = /^```json\n(\{\n {2}"id"[\s\S]*?)^```$/m.exec(read('reference/lines.md'));
    expect(document.findings).toEqual([JSON.parse(sample?.[1] ?? '')]);
    // Its fix is the ignore line it offers, with the reason in place of the placeholder.
    const ignore = document.findings[0]?.instead.flatMap((hunk) => hunk.add).at(-1) ?? '';
    expect(ignore).toBe('ignore drift compose:mailpit - why this difference is meant');
    expect(finished).toContain(`${ignore.split(' - ')[0] ?? ''} - a mail catcher`);
  });

  it('SKILL-212 round 2 ends clean: no findings, and the footer the worked example shows', () => {
    const dir = project(finished);
    const document = json(dir);
    expect(document.findings).toEqual([]);
    expect(document.summary).toMatchObject({ drift: 0, likely: 0, ignored: 1, exitCode: 0 });
    const text = drift(dir);
    expect(text.status).toBe(0);
    expect(footer(text.out)).toBe(shown('**Drift round 2.**', 'text'));
  });

  it('SKILL-213 a code change that adds a service is found, and the diagram update in the same change ends clean', () => {
    const dir = project(finished);
    apply(dir, shown('**The code change.**', 'diff'));
    const after = drift(dir);
    expect(after.status).toBe(1);
    expect(`${after.out.split('\nNot checked (')[0]?.trimEnd() ?? ''}\n`).toBe(
      shown('**Drift after the change.**', 'text'),
    );
    expect(json(dir).findings.map((each) => each.key)).toEqual(['undrawn-code:compose:cache']);

    apply(dir, shown("**The diagram's update.**", 'diff'));
    expect(aerie(['check', 'architecture.aerie'], dir).out).toBe('No problems found.\n');
    expect(aerie(['format', '--check', 'architecture.aerie'], dir).status).toBe(0);
    expect(json(dir).findings).toEqual([]);
    const clean = drift(dir);
    expect(clean.status).toBe(0);
    expect(footer(clean.out)).toBe(shown('and drift again:', 'text'));
  });

  it('SKILL-212 the reference gives the usual fix of every kind of finding', () => {
    // A record of every kind, so a new kind fails to compile until the skill knows it.
    const kinds: Record<FindingKind, true> = {
      'missing-code': true,
      'renamed-code': true,
      'undrawn-code': true,
      'undrawn-connection': true,
      'missing-connection': true,
      'undrawn-dependency': true,
      'missing-dependency': true,
      'unanswered-calls': true,
      'unused-ignore': true,
    };
    const rows = tableAfter(read('reference/lines.md'), '## Fixing drift findings');
    expect(rows.map((row) => row[0]?.replace(/`/g, '')).sort()).toEqual(Object.keys(kinds).sort());
  });
});
