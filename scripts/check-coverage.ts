// Coverage check for v1 (docs/spec/acceptance.md, ACC-101 and ACC-102): every requirement id the spec
// defines is cited by a test title, and every slice of the plan has its read log. Runs as part of
// `npm run lint`.
//
// A title cites an id when the id appears in it, and a range ("LANG-931 to LANG-941") cites every
// defined id between its ends. Titles are read from the test files' syntax: the first argument of
// `it`, `test` and `describe` (with `.each`, `.skip`, `.only` and `test.describe`), so a title built
// from a template keeps its literal parts. The language fixtures are titled by their file names
// (ACC-012), so their names count as titles too.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import ts from 'typescript';
import { REQUIREMENT, maskCode } from './check-docs.ts';

const SPEC_DIR = 'docs/spec/';
const TEST_FILE = /^tests\/.*\.(?:test|spec)\.ts$/;
const FIXTURE = /^tests\/unit\/lines\/examples\/[^/]+\.aerie$/;
const READ_LOGS = 'docs/clean-room/read-log/';
const TEST_FUNCTIONS = new Set(['it', 'test', 'describe']);

/** Every requirement id the spec defines, in the order the spec defines them. */
export function definedRequirements(markdown: ReadonlyMap<string, string>): string[] {
  const ids: string[] = [];
  for (const [file, text] of markdown) {
    if (!file.startsWith(SPEC_DIR)) continue;
    for (const match of maskCode(text).matchAll(new RegExp(`\\*\\*(${REQUIREMENT})\\b`, 'g'))) {
      ids.push(match[1] ?? '');
    }
  }
  return ids;
}

/** Whether a call's callee is a test function: `it`, `test.describe`, `it.each(rows)` and so on. */
function isTestCall(callee: ts.Expression): boolean {
  let at = callee;
  for (;;) {
    if (ts.isIdentifier(at)) return TEST_FUNCTIONS.has(at.text);
    if (ts.isPropertyAccessExpression(at)) at = at.expression;
    else if (ts.isCallExpression(at)) at = at.expression;
    else return false;
  }
}

/** The literal text of a title argument: a template keeps its literal parts and drops the rest. */
function titleText(argument: ts.Expression): string | undefined {
  if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
    return argument.text;
  }
  if (ts.isTemplateExpression(argument)) {
    return [argument.head.text, ...argument.templateSpans.map((span) => span.literal.text)].join(
      ' ',
    );
  }
  return undefined;
}

/** The titles of the tests and groups in one test file. */
export function testTitles(file: string, source: string): string[] {
  const titles: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isTestCall(node.expression)) {
      const first = node.arguments[0];
      const title = first === undefined ? undefined : titleText(first);
      if (title !== undefined) titles.push(title);
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true));
  return titles;
}

/** The defined ids a set of titles cites, ranges included. */
export function citedRequirements(
  titles: readonly string[],
  defined: readonly string[],
): Set<string> {
  const cited = new Set<string>();
  const known = new Set(defined);
  const id = new RegExp(REQUIREMENT, 'g');
  const range = new RegExp(`(${REQUIREMENT}) to (${REQUIREMENT})`, 'g');
  const number = (each: string): number => Number(each.slice(each.indexOf('-') + 1));
  const prefix = (each: string): string => each.slice(0, each.indexOf('-'));
  for (const title of titles) {
    for (const match of title.matchAll(id)) {
      if (known.has(match[0])) cited.add(match[0]);
    }
    for (const match of title.matchAll(range)) {
      const [from, to] = [match[1] ?? '', match[2] ?? ''];
      if (prefix(from) !== prefix(to)) continue;
      for (const each of defined) {
        if (
          prefix(each) === prefix(from) &&
          number(each) >= number(from) &&
          number(each) <= number(to)
        ) {
          cited.add(each);
        }
      }
    }
  }
  return cited;
}

/** The slices of the plan (`A0`, `A12`, ...) from the table in docs/slice-plan.md. */
export function slicesOf(plan: string): string[] {
  return [...plan.matchAll(/^\|\s*(A\d+)\s*\|/gm)].map((match) => match[1] ?? '');
}

/** The slices with no read log, given the file names in the read log folder (`a7-nav.md`). */
export function slicesWithoutReadLog(slices: readonly string[], logs: readonly string[]): string[] {
  return slices.filter(
    (slice) =>
      !logs.some((log) => log.startsWith(`${slice.toLowerCase()}-`) && log.endsWith('.md')),
  );
}

export interface CoverageInput {
  /** Markdown files by repository path. */
  markdown: ReadonlyMap<string, string>;
  /** Test files by repository path. */
  tests: ReadonlyMap<string, string>;
  /** Other files whose names are titles: the language fixtures. */
  titledFiles: readonly string[];
}

/** What is missing for v1: requirement ids no test title cites, and slices with no read log. */
export function checkCoverage(input: CoverageInput): { uncited: string[]; noReadLog: string[] } {
  const defined = definedRequirements(input.markdown);
  const titles = [
    ...[...input.tests].flatMap(([file, source]) => testTitles(file, source)),
    ...input.titledFiles.map((file) => basename(file)),
  ];
  const cited = citedRequirements(titles, defined);
  const logs = [...input.markdown.keys()]
    .filter((file) => file.startsWith(READ_LOGS))
    .map((file) => file.slice(READ_LOGS.length));
  return {
    uncited: defined.filter((each) => !cited.has(each)),
    noReadLog: slicesWithoutReadLog(slicesOf(input.markdown.get('docs/slice-plan.md') ?? ''), logs),
  };
}

function repoFiles(): string[] {
  const output = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { encoding: 'utf8' },
  );
  return output.split('\0').filter((file) => file !== '');
}

function main(): void {
  const markdown = new Map<string, string>();
  const tests = new Map<string, string>();
  const titledFiles: string[] = [];
  for (const file of repoFiles()) {
    const isMarkdown = file.endsWith('.md');
    const isTest = TEST_FILE.test(file);
    if (FIXTURE.test(file)) titledFiles.push(file);
    if (!isMarkdown && !isTest) continue;
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue; // deleted in the working tree but still tracked
    }
    (isMarkdown ? markdown : tests).set(file, text);
  }
  const { uncited, noReadLog } = checkCoverage({ markdown, tests, titledFiles });
  for (const each of uncited) {
    console.error(`${each} is defined in ${SPEC_DIR} but no test title cites it (ACC-101)`);
  }
  for (const slice of noReadLog) {
    console.error(`slice ${slice} has no read log in ${READ_LOGS} (ACC-102)`);
  }
  if (uncited.length > 0 || noReadLog.length > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  main();
}
