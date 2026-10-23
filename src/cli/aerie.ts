#!/usr/bin/env node
// The `aerie` command: check, format and print the model of Lines files
// (docs/spec/language.md, section 15), watch one (docs/spec/interaction.md, INT-851), and check one
// against its code (docs/spec/drift.md, section 7).
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  allEdits,
  compare,
  jsonReport,
  prComment,
  summarise,
  textReport,
  unifiedDiff,
  type Level,
  type Run,
} from '../drift/index.ts';
import { evidenceText, extract, loadJava, type ExtractInput } from '../extract/index.ts';
import { format, parse, serializeModel, type Diagnostic, type System } from '../lines/index.ts';
import { check as checkSource } from '../model/index.ts';
import { modelInput } from './project.ts';
import { CannotWatch, WATCH_PORT, openInBrowser, watch, type Watching } from './watch.ts';

/** Everything the command touches, so tests can run it without a disk or a terminal. */
export interface Io {
  /** The file's text, or an Error saying why it cannot be read. */
  read: (path: string) => string | Error;
  write: (path: string, text: string) => void;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  /**
   * `aerie watch`: starts watching (with the folder of the built page filled in) and resolves when
   * the author stops it (Ctrl+C). Without it, the command cannot watch.
   */
  watch?: (start: (pages: string) => Promise<Watching>) => Promise<void>;
  /**
   * `aerie drift`: what the extractor reads for a model file and its system root (the project on
   * the disk). Without it, the command cannot check a model against its code.
   */
  project?: (file: string, system: System | null) => ExtractInput;
  /** Milliseconds from any fixed start, to time a drift run; without it no time is printed. */
  now?: () => number;
  /** Whether stdout shows colour: a terminal, without `NO_COLOR`. */
  color?: boolean;
}

const USAGE = `Usage:
  aerie check <file>... [--format text|json]   report every problem in each file
  aerie format <file>... [--check | --stdout]  format each file in place (also: aerie fmt)
  aerie model <file>                           print the canonical model of a file
  aerie watch <file> [--port <n>] [--no-open]  show the file's diagram, updated on every save
  aerie drift <file> [--format text|diff|json|pr] [--fail-on drift|likely]
                                               report where the model and its code differ
`;

/** Thrown for a command that cannot run (exit code 2, LANG-966). */
class CannotRun extends Error {}

interface Options {
  files: string[];
  flags: Set<string>;
  values: Map<string, string>;
}

function readOptions(command: string, args: string[], flags: string[], values: string[]): Options {
  const options: Options = { files: [], flags: new Set(), values: new Map() };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';
    if (!arg.startsWith('--')) {
      options.files.push(arg);
      continue;
    }
    const [name = '', inline] = arg.split(/=(.*)/s);
    if (flags.includes(name) && inline === undefined) {
      options.flags.add(name);
    } else if (values.includes(name)) {
      const value = inline ?? args[++i];
      if (value === undefined) {
        throw new CannotRun(`The option ${name} needs a value, as in ${name} json.`);
      }
      options.values.set(name, value);
    } else {
      throw new CannotRun(`There is no option called ${name} for aerie ${command}.`);
    }
  }
  if (options.files.length === 0) {
    throw new CannotRun(`Name a file, as in aerie ${command} architecture.aerie.`);
  }
  return options;
}

function readFile(io: Io, path: string): string {
  const text = io.read(path);
  if (text instanceof Error) {
    const missing = (text as NodeJS.ErrnoException).code === 'ENOENT';
    throw new CannotRun(
      missing ? `There is no file called ${path}.` : `Aerie cannot read ${path}.`,
    );
  }
  return text;
}

/** One diagnostic as the command line prints it (LANG-962). */
export function diagnosticLine(path: string, found: Diagnostic): string {
  return `${path}:${String(found.line)}:${String(found.column)}: ${found.severity} ${found.id}: ${found.message}`;
}

/** The summary line: `No problems found.`, `2 errors and 1 warning.` or `1 warning.` */
export function summary(errors: number, warnings: number): string {
  const count = (n: number, word: string): string => `${String(n)} ${word}${n === 1 ? '' : 's'}`;
  const parts = [
    ...(errors > 0 ? [count(errors, 'error')] : []),
    ...(warnings > 0 ? [count(warnings, 'warning')] : []),
  ];
  return parts.length === 0 ? 'No problems found.' : `${parts.join(' and ')}.`;
}

const counts = (diagnostics: Diagnostic[]): { errors: number; warnings: number } => ({
  errors: diagnostics.filter((found) => found.severity === 'error').length,
  warnings: diagnostics.filter((found) => found.severity === 'warning').length,
});

function check(args: string[], io: Io): number {
  const options = readOptions('check', args, [], ['--format']);
  const style = options.values.get('--format') ?? 'text';
  if (style !== 'text' && style !== 'json') {
    throw new CannotRun(`--format is text or json, not ${style}.`);
  }
  const files = options.files.map((path) => ({
    path,
    diagnostics: checkSource(readFile(io, path)).diagnostics,
  }));
  const all = counts(files.flatMap((file) => file.diagnostics));
  if (style === 'json') {
    io.stdout(JSON.stringify({ files, ...all }, null, 2) + '\n');
  } else {
    const lines = files.flatMap((file) =>
      file.diagnostics.map((found) => diagnosticLine(file.path, found)),
    );
    io.stdout([...lines, summary(all.errors, all.warnings)].join('\n') + '\n');
  }
  return all.errors > 0 ? 1 : 0;
}

function formatFiles(args: string[], io: Io): number {
  const options = readOptions('format', args, ['--check', '--stdout'], []);
  const toStdout = options.flags.has('--stdout');
  const checkOnly = options.flags.has('--check');
  if (toStdout && checkOnly) {
    throw new CannotRun('Use --check or --stdout, not both.');
  }
  if (toStdout && options.files.length > 1) {
    throw new CannotRun('--stdout prints one file. Name just one.');
  }
  const sources = options.files.map((path) => ({ path, text: readFile(io, path) }));
  let failed = false;
  for (const { path, text } of sources) {
    const result = format(text);
    if (result.diagnostics.length > 0) {
      const lines = result.diagnostics.map((found) => diagnosticLine(path, found));
      io.stderr([...lines, `${path} was not formatted: fix these lines first.`].join('\n') + '\n');
      failed = true;
    } else if (toStdout) {
      io.stdout(result.text);
    } else if (result.changed && checkOnly) {
      io.stdout(`${path}\n`);
      failed = true;
    } else if (result.changed) {
      io.write(path, result.text);
    }
  }
  return failed ? 1 : 0;
}

function model(args: string[], io: Io): number {
  const options = readOptions('model', args, [], []);
  const [path, ...rest] = options.files;
  if (path === undefined || rest.length > 0) {
    throw new CannotRun('aerie model prints one file. Name just one.');
  }
  const result = checkSource(readFile(io, path));
  if (result.model === null) {
    const { errors, warnings } = counts(result.diagnostics);
    const lines = result.diagnostics.map((found) => diagnosticLine(path, found));
    io.stderr([...lines, summary(errors, warnings)].join('\n') + '\n');
    return 1;
  }
  io.stdout(serializeModel(result.model));
  return 0;
}

/** INT-851: `aerie watch <file>`, which runs until the author stops it. */
async function watchFile(args: string[], io: Io): Promise<number> {
  try {
    const options = readOptions('watch', args, ['--no-open'], ['--port']);
    const [path, ...others] = options.files;
    if (path === undefined || others.length > 0) {
      throw new CannotRun('aerie watch shows one file. Name just one.');
    }
    const given = options.values.get('--port');
    const port = given === undefined ? WATCH_PORT : Number(given);
    if (!/^\d+$/.test(given ?? '0') || port > 65535) {
      throw new CannotRun(`--port is a number from 0 to 65535, not ${given ?? ''}.`);
    }
    if (io.watch === undefined) throw new CannotRun('aerie watch needs a terminal to run in.');
    await io.watch((pages) =>
      watch({
        file: path,
        port,
        pages,
        out: io.stdout,
        line: diagnosticLine,
        ...(options.flags.has('--no-open') ? {} : { open: openInBrowser }),
      }),
    );
    return 0;
  } catch (error) {
    if (error instanceof CannotRun || error instanceof CannotWatch) {
      io.stderr(`${error.message}\n`);
      return 2;
    }
    throw error;
  }
}

const DRIFT_FORMATS = ['text', 'diff', 'json', 'pr'] as const;

/**
 * DRIFT-501: `aerie drift <file>`, which compares a model with its code and prints the finding
 * model in one of four forms. Exit codes (DRIFT-503): 0 for no drift, 1 for drift (or likely, with
 * `--fail-on likely`), 2 when drift cannot run.
 */
async function driftFile(args: string[], io: Io): Promise<number> {
  try {
    const options = readOptions('drift', args, [], ['--format', '--fail-on']);
    const [path, ...others] = options.files;
    if (path === undefined || others.length > 0) {
      throw new CannotRun('aerie drift checks one file. Name just one.');
    }
    const style = options.values.get('--format') ?? 'text';
    if (!(DRIFT_FORMATS as readonly string[]).includes(style)) {
      throw new CannotRun(`--format is text, diff, json or pr, not ${style}.`);
    }
    const failOn = options.values.get('--fail-on') ?? 'drift';
    if (failOn !== 'drift' && failOn !== 'likely') {
      throw new CannotRun(`--fail-on is drift or likely, not ${failOn}.`);
    }
    if (io.project === undefined)
      throw new CannotRun('aerie drift needs a disk to read code from.');
    const started = io.now?.();
    const source = readFile(io, path);
    const errors = checkSource(source).diagnostics.filter((found) => found.severity === 'error');
    const parsed = parse(source);
    if (errors.length > 0 || parsed.model === null) {
      const lines = errors.map((found) => diagnosticLine(path, found));
      throw new CannotRun(
        [...lines, `Drift cannot run until ${path} has no errors (aerie check ${path}).`].join(
          '\n',
        ),
      );
    }
    const extraction = extract({
      ...io.project(path, parsed.model.system),
      java: await loadJava(),
    });
    const stops = extraction.problems.filter((problem) => problem.level === 'error');
    if (stops.length > 0) {
      const lines = stops.map(
        (problem) => `${problem.at === null ? path : evidenceText(problem.at)}: ${problem.message}`,
      );
      throw new CannotRun(
        [...lines, 'Drift cannot run until the system root is fixed.'].join('\n'),
      );
    }
    const drift = compare({
      source,
      model: parsed.model,
      sourceMap: parsed.sourceMap,
      extraction,
    });
    const ended = io.now?.();
    const report: Run = {
      file: path,
      source,
      model: parsed.model,
      extraction,
      drift,
      failOn: failOn satisfies Level,
      seconds: started === undefined || ended === undefined ? null : (ended - started) / 1000,
    };
    switch (style) {
      case 'diff':
        io.stdout(unifiedDiff(path, source, allEdits(drift)));
        break;
      case 'json':
        io.stdout(jsonReport(report));
        break;
      case 'pr':
        io.stdout(prComment(report));
        break;
      default:
        io.stdout(textReport(report, { color: io.color === true }));
    }
    return summarise(report).exitCode;
  } catch (error) {
    if (error instanceof CannotRun) {
      io.stderr(`${error.message}\n`);
      return 2;
    }
    throw error;
  }
}

/**
 * Runs the command with its arguments and returns the exit code (LANG-966); `aerie watch` returns
 * it once the author stops watching, and `aerie drift` once it has read the code.
 */
export function run(args: string[], io: Io): number | Promise<number> {
  const [command, ...rest] = args;
  if (command === 'watch') return watchFile(rest, io);
  if (command === 'drift') return driftFile(rest, io);
  try {
    switch (command) {
      case 'check':
        return check(rest, io);
      case 'format':
      case 'fmt':
        return formatFiles(rest, io);
      case 'model':
        return model(rest, io);
      case '--help':
      case 'help':
        io.stdout(USAGE);
        return 0;
      case undefined:
        io.stderr(USAGE);
        return 2;
      default:
        io.stderr(`There is no command called ${command}.\n${USAGE}`);
        return 2;
    }
  } catch (error) {
    if (error instanceof CannotRun) {
      io.stderr(`${error.message}\n`);
      return 2;
    }
    throw error;
  }
}

/** The real disk and terminal. */
export const nodeIo: Io = {
  read: (path) => {
    try {
      return readFileSync(path, 'utf8');
    } catch (error) {
      return error instanceof Error ? error : new Error(String(error));
    }
  },
  write: (path, text) => {
    writeFileSync(path, text, 'utf8');
  },
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  project: modelInput,
  now: () => performance.now(),
  color: process.stdout.isTTY && (process.env['NO_COLOR'] ?? '') === '',
  watch: async (start) => {
    const watching = await start(fileURLToPath(new URL('../../dist/', import.meta.url)));
    await new Promise<void>((stopped) => {
      process.once('SIGINT', () => {
        void watching.close().then(() => {
          process.stdout.write('Stopped watching.\n');
          stopped();
        });
      });
    });
  },
};

function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  void Promise.resolve(run(process.argv.slice(2), nodeIo)).then((code) => {
    process.exitCode = code;
  });
}
