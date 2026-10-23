// The `aerie` command (docs/spec/language.md, section 14), run against files in memory.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run, summary, type Io } from '../../../src/cli/aerie.ts';

const ROOT = join(import.meta.dirname, '../../..');
const LOTTO = readFileSync(join(ROOT, 'samples/lotto.aerie'), 'utf8');

function fakeIo(files: Record<string, string>): Io & {
  out: string;
  err: string;
  files: Record<string, string>;
} {
  const io = {
    out: '',
    err: '',
    files: { ...files },
    read: (path: string): string | Error => {
      const text = io.files[path];
      if (text !== undefined) return text;
      return Object.assign(new Error('missing'), { code: 'ENOENT' });
    },
    write: (path: string, text: string): void => {
      io.files[path] = text;
    },
    stdout: (text: string): void => {
      io.out += text;
    },
    stderr: (text: string): void => {
      io.err += text;
    },
  };
  return io;
}

const BROKEN = 'website: Website\nscreen-api: Screen API\nwebsite gets data from screen-apu\n';
/** Valid for the parser, but its walkthrough focuses on an element its view never draws. */
const UNSEEN =
  'box: Box\n  x: X\ny: Y\nx calls y\nview v: V\n  show y\nwalkthrough w: W\n  step v: x\n';

describe('aerie check', () => {
  it('LANG-961 LANG-962 prints one line per diagnostic and a summary', () => {
    const io = fakeIo({ 'samples/lotto.aerie': LOTTO });
    expect(run(['check', 'samples/lotto.aerie'], io)).toBe(0);
    expect(io.out).toBe(
      'samples/lotto.aerie:281:3: warning W601: No relationship joins `updater` and `saved-draws` in the model. Add one, such as `updater saves draws into saved-draws`, or check this step.\n' +
        '1 warning.\n',
    );
  });

  it('LANG-961 checks several files, sorted within each', () => {
    const io = fakeIo({ 'a.aerie': BROKEN, 'b.aerie': 'web: Website\n' });
    expect(run(['check', 'a.aerie', 'b.aerie'], io)).toBe(1);
    expect(io.out).toBe(
      'a.aerie:3:24: error E008: There is no element called `screen-apu`. Did you mean `screen-api`?\n' +
        '1 error.\n',
    );
  });

  it('LANG-961 reports the diagnostics that need the model meaning, such as E703', () => {
    const io = fakeIo({ 'a.aerie': UNSEEN });
    expect(run(['check', 'a.aerie'], io)).toBe(1);
    expect(io.out).toBe(
      "a.aerie:8:11: error E703: `x` is not visible in this step's picture of `v`, so the step cannot focus on it. Open its container with `open box`, or choose a view that shows it.\n" +
        '1 error.\n',
    );
  });

  it('LANG-962 the summary counts errors and warnings', () => {
    expect(summary(0, 0)).toBe('No problems found.');
    expect(summary(2, 1)).toBe('2 errors and 1 warning.');
    expect(summary(0, 1)).toBe('1 warning.');
    expect(summary(1, 3)).toBe('1 error and 3 warnings.');
    const io = fakeIo({ 'ok.aerie': 'web: Website\n' });
    expect(run(['check', 'ok.aerie'], io)).toBe(0);
    expect(io.out).toBe('No problems found.\n');
  });

  it('LANG-963 --format json prints one document with every diagnostic and the counts', () => {
    const io = fakeIo({ 'samples/lotto.aerie': LOTTO });
    expect(run(['check', 'samples/lotto.aerie', '--format', 'json'], io)).toBe(0);
    expect(JSON.parse(io.out)).toEqual({
      files: [
        {
          path: 'samples/lotto.aerie',
          diagnostics: [
            {
              id: 'W601',
              severity: 'warning',
              line: 281,
              column: 3,
              endLine: 281,
              endColumn: 39,
              message:
                'No relationship joins `updater` and `saved-draws` in the model. Add one, such as `updater saves draws into saved-draws`, or check this step.',
            },
          ],
        },
      ],
      errors: 0,
      warnings: 1,
    });
    const inline = fakeIo({ 'a.aerie': BROKEN });
    expect(run(['check', '--format=json', 'a.aerie'], inline)).toBe(1);
    expect(JSON.parse(inline.out)).toMatchObject({ errors: 1, warnings: 0 });
  });
});

describe('aerie format', () => {
  const messy = 'web:   Website\n\n\n\napi: Screen API\n';
  const tidy = 'web: Website\n\napi: Screen API\n';

  it('LANG-964 formats each file in place', () => {
    const io = fakeIo({ 'a.aerie': messy, 'b.aerie': tidy });
    expect(run(['format', 'a.aerie', 'b.aerie'], io)).toBe(0);
    expect(io.files).toEqual({ 'a.aerie': tidy, 'b.aerie': tidy });
    expect(io.out).toBe('');
  });

  it('LANG-964 --check changes nothing and lists the files that would change', () => {
    const io = fakeIo({ 'a.aerie': messy, 'b.aerie': tidy });
    expect(run(['format', '--check', 'a.aerie', 'b.aerie'], io)).toBe(1);
    expect(io.out).toBe('a.aerie\n');
    expect(io.files['a.aerie']).toBe(messy);
    expect(run(['format', '--check', 'b.aerie'], fakeIo({ 'b.aerie': tidy }))).toBe(0);
  });

  it('LANG-964 --stdout prints the formatted text of one file', () => {
    const io = fakeIo({ 'a.aerie': messy });
    expect(run(['format', 'a.aerie', '--stdout'], io)).toBe(0);
    expect(io.out).toBe(tidy);
    expect(io.files['a.aerie']).toBe(messy);
  });

  it('LANG-964 aerie fmt is the same command', () => {
    const io = fakeIo({ 'a.aerie': messy });
    expect(run(['fmt', 'a.aerie'], io)).toBe(0);
    expect(io.files['a.aerie']).toBe(tidy);
  });

  it('LANG-936 a file that cannot be formatted is left alone, with its diagnostics', () => {
    const source = 'web: Website\n\tapi: Screen API\n';
    const io = fakeIo({ 'a.aerie': source });
    expect(run(['format', 'a.aerie'], io)).toBe(1);
    expect(io.files['a.aerie']).toBe(source);
    expect(io.err).toBe(
      'a.aerie:2:1: error E001: This line is indented with a tab. Indent with spaces instead.\n' +
        'a.aerie was not formatted: fix these lines first.\n',
    );
  });
});

describe('aerie model', () => {
  it('LANG-965 prints the canonical model of a valid file', () => {
    const shop = readFileSync(join(ROOT, 'docs/spec/examples/shop.aerie'), 'utf8');
    const io = fakeIo({ 'shop.aerie': shop });
    expect(run(['model', 'shop.aerie'], io)).toBe(0);
    expect(io.out).toBe(readFileSync(join(ROOT, 'docs/spec/examples/shop.json'), 'utf8'));
  });

  it('LANG-965 a file with a model-stage error has no model', () => {
    const io = fakeIo({ 'a.aerie': UNSEEN });
    expect(run(['model', 'a.aerie'], io)).toBe(1);
    expect(io.out).toBe('');
    expect(io.err).toContain('a.aerie:8:11: error E703:');
  });

  it('LANG-965 prints the diagnostics instead for a file with errors', () => {
    const io = fakeIo({ 'a.aerie': BROKEN });
    expect(run(['model', 'a.aerie'], io)).toBe(1);
    expect(io.out).toBe('');
    expect(io.err).toContain('a.aerie:3:24: error E008:');
    expect(io.err).toContain('1 error.');
  });
});

describe('exit codes', () => {
  it('LANG-966 is 2 with a plain message when the command cannot run', () => {
    const cases: [string[], string][] = [
      [['check', 'lotto.aere'], 'There is no file called lotto.aere.\n'],
      [['check', 'a.aerie', '--verbose'], 'There is no option called --verbose for aerie check.\n'],
      [['check', 'a.aerie', '--format', 'xml'], '--format is text or json, not xml.\n'],
      [
        ['check', 'a.aerie', '--format'],
        'The option --format needs a value, as in --format json.\n',
      ],
      [['check'], 'Name a file, as in aerie check architecture.aerie.\n'],
      [['format', 'a.aerie', 'b.aerie', '--stdout'], '--stdout prints one file. Name just one.\n'],
      [['format', 'a.aerie', '--stdout', '--check'], 'Use --check or --stdout, not both.\n'],
      [['model', 'a.aerie', 'b.aerie'], 'aerie model prints one file. Name just one.\n'],
    ];
    for (const [args, message] of cases) {
      const io = fakeIo({ 'a.aerie': 'web: Website\n', 'b.aerie': 'web: Website\n' });
      expect(run(args, io), args.join(' ')).toBe(2);
      expect(io.err, args.join(' ')).toBe(message);
    }
    const unknown = fakeIo({});
    expect(run(['draw'], unknown)).toBe(2);
    expect(unknown.err).toMatch(/^There is no command called draw\.\nUsage:/);
    expect(run([], fakeIo({}))).toBe(2);
    const help = fakeIo({});
    expect(run(['--help'], help)).toBe(0);
    expect(help.out).toMatch(/^Usage:/);
  });

  it('LANG-966 is 0 with only warnings and 1 with errors', () => {
    expect(run(['check', 'lotto.aerie'], fakeIo({ 'lotto.aerie': LOTTO }))).toBe(0);
    expect(run(['check', 'a.aerie'], fakeIo({ 'a.aerie': BROKEN }))).toBe(1);
  });

  it('LANG-961 the installed command runs as `npx aerie` from the repository', () => {
    const output = execFileSync('npx', ['aerie', 'check', 'samples/lotto.aerie'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(output).toMatch(/^samples\/lotto\.aerie:281:3: warning W601: .*\n1 warning\.\n$/);
  });
});
