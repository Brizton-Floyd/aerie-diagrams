// `aerie drift` and its four reports (docs/spec/drift.md, section 7; DRIFT-501 to DRIFT-509), run
// as the command line runs them on the fixture projects and the Lotto benchmark. The reports are
// kept in reports/, one file per model and form; update them deliberately with
// `npx vitest run --project unit -u` and review the difference.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run, type Io } from '../../../src/cli/aerie.ts';
import { modelInput } from '../../../src/cli/project.ts';
import {
  applyHunks,
  commentMarker,
  diffHunks,
  FORMAT,
  unifiedDiff,
  type DriftDocument,
} from '../../../src/drift/index.ts';
import { wrap } from '../../../src/drift/text.ts';

const ROOT = join(import.meta.dirname, '../../..');
const REPORTS = join(import.meta.dirname, 'reports');

/** A model of the fixtures or the benchmark, as the command line names it from the repo's root. */
const fixture = (name: string, model: string): string =>
  relative(ROOT, join(import.meta.dirname, 'fixtures', name, `${model}.aerie`));
const LOTTO = relative(ROOT, join(import.meta.dirname, 'lotto', 'lotto.aerie'));

interface Ran {
  code: number;
  out: string;
  err: string;
}

/** The command run on the disk from the repo's root, each run taking 0.9 s. */
async function drift(...args: string[]): Promise<Ran> {
  const ran = { out: '', err: '' };
  let clock = 0;
  const io: Io = {
    read: (path) => {
      try {
        return readFileSync(resolve(ROOT, path), 'utf8');
      } catch (error) {
        return error as Error;
      }
    },
    write: () => {
      throw new Error('aerie drift never writes');
    },
    stdout: (text) => {
      ran.out += text;
    },
    stderr: (text) => {
      ran.err += text;
    },
    project: (file, system) => modelInput(resolve(ROOT, file), system),
    now: () => (clock += 900) - 900,
  };
  const code = await run(['drift', ...args], io);
  return { code, ...ran };
}

/** A report kept in reports/. */
async function expectReport(text: string, name: string): Promise<void> {
  await expect(text).toMatchFileSnapshot(join(REPORTS, name));
}

const DRIFTED = [
  ['compose', fixture('compose', 'shop-drift')],
  ['spring', fixture('spring', 'shop-drift')],
  ['angular', fixture('angular', 'shop-drift')],
] as const;

const CLEAN = [
  ['compose', fixture('compose', 'shop')],
  ['spring', fixture('spring', 'shop')],
  ['angular', fixture('angular', 'shop')],
] as const;

/** Applies a patch with `git apply`, as an author would, to a copy of the model beside it. */
async function roundTrip(model: string): Promise<Ran> {
  const copy = model.replace(/\.aerie$/, '.round-trip.aerie');
  const folder = mkdtempSync(join(tmpdir(), 'aerie-drift-'));
  try {
    writeFileSync(join(ROOT, copy), readFileSync(join(ROOT, model), 'utf8'));
    const patch = await drift(copy, '--format', 'diff');
    expect(patch.out).not.toBe('');
    writeFileSync(join(folder, 'edits.diff'), patch.out);
    execFileSync('git', ['apply', join(folder, 'edits.diff')], { cwd: ROOT });
    return await drift(copy);
  } finally {
    rmSync(join(ROOT, copy), { force: true });
    rmSync(folder, { recursive: true, force: true });
  }
}

describe('DRIFT-509 the reports of the fixture projects and the Lotto benchmark', () => {
  it.each(DRIFTED)('DRIFT-505 the text report of %s with planted drifts', async (name, model) => {
    const ran = await drift(model);
    expect(ran.code).toBe(1);
    await expectReport(ran.out, `${name}-drift.txt`);
  });

  it.each(DRIFTED)('DRIFT-506 the patch of %s with planted drifts', async (name, model) => {
    const ran = await drift(model, '--format', 'diff');
    expect(ran.code).toBe(1);
    await expectReport(ran.out, `${name}-drift.diff`);
  });

  it.each(DRIFTED)('DRIFT-507 the JSON of %s with planted drifts', async (name, model) => {
    const ran = await drift(model, '--format', 'json');
    expect(ran.code).toBe(1);
    await expectReport(ran.out, `${name}-drift.json`);
  });

  it.each(DRIFTED)('DRIFT-508 the PR comment of %s with planted drifts', async (name, model) => {
    const ran = await drift(model, '--format', 'pr');
    expect(ran.code).toBe(1);
    await expectReport(ran.out, `${name}-drift.md`);
  });

  it.each(CLEAN)(
    'DRIFT-505 DRIFT-508 the matching model of %s reports no drift',
    async (name, model) => {
      const ran = await drift(model);
      expect(ran.code).toBe(0);
      expect(ran.out).toContain('\nNo drift. Exit code 0.\n');
      await expectReport(ran.out, `${name}.txt`);
      const pr = await drift(model, '--format', 'pr');
      expect(pr.out).toContain('### 🟢 Aerie drift:');
    },
  );

  it('DRIFT-505 DRIFT-506 the text report and the patch of the Lotto benchmark', async () => {
    const text = await drift(LOTTO);
    expect(text.code).toBe(1);
    await expectReport(text.out, 'lotto.txt');
    await expectReport((await drift(LOTTO, '--format', 'diff')).out, 'lotto.diff');
  });
});

describe('DRIFT-506 the patch round trip', () => {
  it.each(DRIFTED)(
    'DRIFT-506 %s: git apply takes the patch, and drift then finds no drift',
    async (_name, model) => {
      const after = await roundTrip(model);
      expect(after.code).toBe(0);
      expect(after.out).toContain('\nNo drift');
    },
  );

  it('DRIFT-506 Lotto: git apply takes the patch, and drift then finds no drift', async () => {
    const after = await roundTrip(LOTTO);
    expect(after.code).toBe(0);
    expect(after.out).toMatch(/\nNo drift[,.]/);
  });
});

describe('DRIFT-501 DRIFT-503 aerie drift', () => {
  it('DRIFT-503 likely alone passes by default and fails with --fail-on likely', async () => {
    const model = fixture('compose', 'likely-only');
    // The matching model with one line no code shows: a likely finding, and nothing else.
    const shop = readFileSync(join(ROOT, fixture('compose', 'shop')), 'utf8');
    const source = `${shop}web calls worker\n`;
    writeFileSync(join(ROOT, model), source);
    try {
      const loose = await drift(model);
      expect(loose.out).toContain('No drift, 1 likely. Exit code 0.');
      expect(loose.code).toBe(0);
      const strict = await drift(model, '--fail-on', 'likely');
      expect(strict.out).toContain('No drift, 1 likely. Exit code 1.');
      expect(strict.code).toBe(1);
      const pr = await drift(model, '--fail-on', 'likely', '--format', 'pr');
      expect(pr.out).toContain('### 🟡 Aerie drift:');
      expect(pr.out).toContain('**1 likely** (fails this check)');
    } finally {
      rmSync(join(ROOT, model), { force: true });
    }
  });

  it('DRIFT-501 DRIFT-503 cannot run (exit 2) without a model, with errors, or with a bad option', async () => {
    expect(await drift()).toMatchObject({
      code: 2,
      err: 'Name a file, as in aerie drift architecture.aerie.\n',
    });
    expect(await drift('nowhere.aerie')).toMatchObject({
      code: 2,
      err: 'There is no file called nowhere.aerie.\n',
    });
    expect(await drift(LOTTO, LOTTO)).toMatchObject({
      code: 2,
      err: 'aerie drift checks one file. Name just one.\n',
    });
    expect(await drift(LOTTO, '--format', 'html')).toMatchObject({
      code: 2,
      err: '--format is text, diff, json or pr, not html.\n',
    });
    expect(await drift(LOTTO, '--fail-on', 'never')).toMatchObject({
      code: 2,
      err: '--fail-on is drift or likely, not never.\n',
    });
  });

  it('DRIFT-501 DRIFT-503 cannot run (exit 2) on a model with errors or a system root that names nothing', async () => {
    const model = fixture('compose', 'broken');
    const missing = fixture('compose', 'missing');
    writeFileSync(join(ROOT, model), 'web: Web\nweb calls api\n');
    writeFileSync(join(ROOT, missing), 'system\n  repo gone\n\nweb: Web\n');
    try {
      const broken = await drift(model);
      expect(broken.code).toBe(2);
      expect(broken.out).toBe('');
      expect(broken.err).toBe(
        `${model}:2:11: error E008: There is no element called \`api\`.\n` +
          `Drift cannot run until ${model} has no errors (aerie check ${model}).\n`,
      );
      const gone = await drift(missing);
      expect(gone.code).toBe(2);
      expect(gone.err).toBe(
        `${missing}: The system root names the repo \`gone\`, but there is no such folder.\n` +
          'Drift cannot run until the system root is fixed.\n',
      );
    } finally {
      rmSync(join(ROOT, model), { force: true });
      rmSync(join(ROOT, missing), { force: true });
    }
  });

  it('DRIFT-501 is listed in the usage', async () => {
    let out = '';
    const io = {
      read: () => '',
      write: () => undefined,
      stdout: (text: string) => (out += text),
      stderr: () => undefined,
    };
    expect(await run(['help'], io)).toBe(0);
    expect(out).toContain(
      'aerie drift <file> [--format text|diff|json|pr] [--fail-on drift|likely]',
    );
  });

  it('DRIFT-501 needs a disk to read code from', async () => {
    let err = '';
    const io: Io = {
      read: () => 'web: Web\n',
      write: () => undefined,
      stdout: () => undefined,
      stderr: (text) => (err += text),
    };
    expect(await run(['drift', 'a.aerie'], io)).toBe(2);
    expect(err).toBe('aerie drift needs a disk to read code from.\n');
  });
});

describe('DRIFT-505 the text report', () => {
  it('DRIFT-505 colours a terminal that shows colour, and nothing else', async () => {
    const model = fixture('compose', 'shop-drift');
    const plain = await drift(model);
    expect(plain.out).not.toContain('\u001b[');
    let out = '';
    const io: Io = {
      read: (path) => readFileSync(resolve(ROOT, path), 'utf8'),
      write: () => undefined,
      stdout: (text) => (out += text),
      stderr: () => undefined,
      project: (file, system) => modelInput(resolve(ROOT, file), system),
      color: true,
    };
    expect(await run(['drift', model], io)).toBe(1);
    expect(out).toContain('\u001b[31mD01\u001b[0m The code line of Payments');
    const escape = new RegExp(`${String.fromCharCode(27)}\\[\\d+m`, 'g');
    expect(out.replace(escape, '').replace(/ in \d+\.\d s\./, '.')).toBe(
      plain.out.replace(' in 0.9 s.', '.'),
    );
  });

  it('DRIFT-505 wraps prose at 100 columns and never breaks a word', () => {
    const words = Array.from({ length: 40 }, (_, i) => `word${String(i)}`).join(' ');
    const lines = wrap(words, 'D01 ', '    ');
    expect(lines.every((line) => line.length <= 100)).toBe(true);
    expect(lines[0]?.startsWith('D01 word0 ')).toBe(true);
    expect(lines.slice(1).every((line) => line.startsWith('    word'))).toBe(true);
    expect(lines.join(' ').replace(/\s+/g, ' ')).toBe(`D01 ${words}`);
    expect(wrap('x'.repeat(120), '  ')).toEqual([`  ${'x'.repeat(120)}`]);
  });

  it('DRIFT-504 collapses what is not checked per element, and the scenarios into one line', async () => {
    const ran = await drift(LOTTO);
    const section = ran.out.slice(ran.out.indexOf('Not checked (')).replace(/\s+/g, ' ');
    expect(section).toContain(
      'lotto.aerie:19 User is a person, which code cannot show. The line “User uses Website” (line 246) is not checked either.',
    );
    expect(section).not.toContain('The line “User uses Website” is not checked');
    expect(section).toContain('2 scenarios (`generate-picks` and `results-poll`) are not checked');
  });

  it('DRIFT-502 says what was checked, in how long, and how much the code confirms', async () => {
    const ran = await drift(LOTTO);
    expect(ran.out.split('\n').slice(0, 2)).toEqual([
      `aerie drift ${LOTTO}`,
      'Checked against lotto-options-core, lotto-options-ui, lottery-result-persistence-service (4 Compose services, 14 Maven modules, 1 npm package, 4 apps) in 0.9 s.',
    ]);
    expect(ran.out).toMatch(/\n\d+ of 19 elements and \d+ of 21 lines confirmed by the code\.\n/);
  });
});

describe('DRIFT-506 the unified diff', () => {
  const source = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', ''].join('\n');

  /** The diff applied by `git apply` to a file with the source, which must give `expected`. */
  function expectApplies(text: string, hunks: Parameters<typeof unifiedDiff>[2]): void {
    const folder = mkdtempSync(join(tmpdir(), 'aerie-diff-'));
    try {
      writeFileSync(join(folder, 'm.aerie'), text);
      writeFileSync(join(folder, 'm.diff'), unifiedDiff('m.aerie', text, hunks));
      execFileSync('git', ['apply', 'm.diff'], { cwd: folder });
      const expected = applyHunks(text, hunks);
      expect(readFileSync(join(folder, 'm.aerie'), 'utf8')).toBe(
        text.includes('\r\n') ? expected.replace(/\n/g, '\r\n') : expected,
      );
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }

  it('DRIFT-506 is empty with no edits, and names the file a/ and b/', () => {
    expect(unifiedDiff('m.aerie', source, [])).toBe('');
    expect(unifiedDiff('m.aerie', source, [{ at: 5, remove: ['e'], add: ['E'] }])).toBe(
      '--- a/m.aerie\n+++ b/m.aerie\n@@ -2,7 +2,7 @@\n b\n c\n d\n-e\n+E\n f\n g\n h\n',
    );
  });

  it('DRIFT-506 joins changes whose context touches, and keeps the others apart', () => {
    expect(
      diffHunks(source, [
        { at: 2, remove: [], add: ['x'] },
        { at: 6, remove: ['f'], add: [] },
      ]),
    ).toBe('@@ -1,9 +1,9 @@\n a\n+x\n b\n c\n d\n e\n-f\n g\n h\n i\n');
    expect(
      diffHunks(source, [
        { at: 1, remove: ['a'], add: ['A'] },
        { at: 10, remove: [], add: ['y'] },
      ]),
    ).toBe('@@ -1,4 +1,4 @@\n-a\n+A\n b\n c\n d\n@@ -7,4 +7,5 @@\n g\n h\n i\n+y\n j\n');
  });

  it('DRIFT-506 applies with git apply: insertions, removals, the end of the file and no final newline', () => {
    expectApplies(source, [{ at: 11, remove: [], add: ['k', 'l'] }]);
    expectApplies(source, [{ at: 1, remove: [], add: ['top'] }]);
    expectApplies(source, [{ at: 3, remove: ['c', 'd'], add: [] }]);
    const bare = source.slice(0, -1);
    expectApplies(bare, [{ at: 10, remove: ['j'], add: ['J'] }]);
    expectApplies(bare, [{ at: 11, remove: [], add: ['k'] }]);
    expectApplies(bare, [{ at: 9, remove: ['i', 'j'], add: [] }]);
    expectApplies(bare, [{ at: 2, remove: ['b'], add: ['B'] }]);
  });

  it('DRIFT-506 keeps the CRLF line endings of a file, so git apply takes the patch', () => {
    const crlf = source.replace(/\n/g, '\r\n');
    expect(unifiedDiff('m.aerie', crlf, [{ at: 5, remove: ['e'], add: ['E'] }])).toContain(
      ' d\r\n-e\r\n+E\r\n f\r\n',
    );
    expectApplies(crlf, [{ at: 5, remove: ['e'], add: ['E'] }]);
    expectApplies(crlf, [{ at: 11, remove: [], add: ['k'] }]);
    expectApplies(crlf.slice(0, -2), [{ at: 10, remove: ['j'], add: ['J'] }]);
  });

  it('DRIFT-506 names a model given by its absolute path relative to the folder drift ran in', async () => {
    const model = fixture('compose', 'shop-drift');
    const relative = await drift(model, '--format', 'diff');
    const absolute = await drift(join(ROOT, model), '--format', 'diff');
    expect(absolute.out).toBe(relative.out);
    expect(absolute.out.split('\n')[0]).toBe(`--- a/${model}`);
  });

  it('DRIFT-506 refuses an edit that does not match the file', () => {
    expect(() => diffHunks(source, [{ at: 2, remove: ['z'], add: [] }])).toThrow(
      'The edit at line 2 does not match the file.',
    );
  });
});

describe('DRIFT-507 DRIFT-508 the JSON and the PR comment', () => {
  it('DRIFT-507 is one aerie-drift/1 document with a stable key per finding', async () => {
    const model = fixture('compose', 'shop-drift');
    const first = JSON.parse((await drift(model, '--format', 'json')).out) as DriftDocument;
    const again = JSON.parse((await drift(model, '--format', 'json')).out) as DriftDocument;
    expect(first.format).toBe(FORMAT);
    expect(first.format).toBe('aerie-drift/1');
    expect(Object.keys(first)).toEqual([
      'format',
      'model',
      'repos',
      'summary',
      'findings',
      'suggestions',
      'notChecked',
      'ignored',
      'confirmed',
      'problems',
    ]);
    expect(first.summary).toMatchObject({ drift: 4, likely: 3, exitCode: 1, failOn: 'drift' });
    expect(first.findings.map((each) => each.key)).toEqual(again.findings.map((each) => each.key));
    expect(first.findings[0]?.evidence[0]).toEqual({
      technique: 'compose-service',
      name: 'Compose service',
      at: 'stack/compose.yaml:19',
      detail: 'compose:payments',
      corroborates: false,
    });
    expect(first.ignored[0]?.excused[0]?.id).toBeNull();
  });

  it('DRIFT-508 starts with the hidden marker of its model file, then a status dot', async () => {
    const model = fixture('compose', 'shop-drift');
    const pr = (await drift(model, '--format', 'pr')).out.split('\n');
    expect(pr[0]).toBe(commentMarker(model));
    expect(pr[0]).toBe(`<!-- aerie-drift: ${model} -->`);
    expect(pr[1]).toBe(`### 🔴 Aerie drift: \`${model}\``);
    expect(pr[3]).toMatch(/^\*\*4 drift\*\* \(fails this check\), \*\*3 likely\*\*, /);
    const strict = (await drift(model, '--format', 'pr', '--fail-on', 'likely')).out.split('\n');
    expect(strict[3]).toMatch(
      /^\*\*4 drift\*\* \(fails this check\), \*\*3 likely\*\* \(fails this check\), /,
    );
  });
});
