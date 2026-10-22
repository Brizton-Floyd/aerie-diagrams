#!/usr/bin/env node
// The `aerie` command: check, format and print the model of Lines files
// (docs/spec/language.md, section 14).
import { readFileSync, writeFileSync } from 'node:fs';
import { format, parse, serializeModel, type Diagnostic } from '../lines/index.ts';

/** Everything the command touches, so tests can run it without a disk or a terminal. */
export interface Io {
  /** The file's text, or an Error saying why it cannot be read. */
  read: (path: string) => string | Error;
  write: (path: string, text: string) => void;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

const USAGE = `Usage:
  aerie check <file>... [--format text|json]   report every problem in each file
  aerie format <file>... [--check | --stdout]  format each file in place (also: aerie fmt)
  aerie model <file>                           print the canonical model of a file
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
    diagnostics: parse(readFile(io, path)).diagnostics,
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
  const result = parse(readFile(io, path));
  if (result.model === null) {
    const { errors, warnings } = counts(result.diagnostics);
    const lines = result.diagnostics.map((found) => diagnosticLine(path, found));
    io.stderr([...lines, summary(errors, warnings)].join('\n') + '\n');
    return 1;
  }
  io.stdout(serializeModel(result.model));
  return 0;
}

/** Runs the command with its arguments and returns the exit code (LANG-966). */
export function run(args: string[], io: Io): number {
  const [command, ...rest] = args;
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
};

if (import.meta.main) {
  process.exitCode = run(process.argv.slice(2), nodeIo);
}
