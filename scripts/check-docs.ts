// Docs check: links between Markdown files resolve, and the spec's requirement and diagnostic ids
// are defined once and cited only where defined. Runs as part of `npm run lint`.
// Conventions: docs/spec/overview.md, "Reading this spec".
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

export interface DocFinding {
  file: string;
  line: number;
  column: number;
  message: string;
}

export interface DocSet {
  /** Markdown files by repository path. */
  markdown: ReadonlyMap<string, string>;
  /** Source and test files that may cite requirement ids. */
  code: ReadonlyMap<string, string>;
  /** Whether a repository path exists (file or directory). */
  exists: (path: string) => boolean;
}

const SPEC_DIR = 'docs/spec/';
const PREFIXES = [
  'EXPORT',
  'SCOPE',
  'LANG',
  'MODEL',
  'LAYOUT',
  'RULE',
  'SCORE',
  'LOOK',
  'INT',
  'ACC',
  'JOURNEY',
  'SKILL',
  'DRIFT',
];
export const REQUIREMENT = `(?:${PREFIXES.join('|')})-\\d{3}`;
const DIAGNOSTIC = '[EW]\\d{3}';
const AVOIDED_WORDS = /\b(?:resources?|perspectives?|sequences?|detail levels?)\b/gi;
const EXTERNAL_LINK = /^[a-z][a-z0-9+.-]*:/i;

interface Position {
  line: number;
  column: number;
}

function positionAt(text: string, index: number): Position {
  const before = text.slice(0, index);
  return { line: before.split('\n').length, column: index - before.lastIndexOf('\n') };
}

const blankOut = (text: string): string => text.replace(/[^\n]/g, ' ');

const FENCE = /^\s*(`{3,}|~{3,})/;

/** Replaces fenced code blocks and inline code spans with spaces, keeping every position. */
export function maskCode(markdown: string): string {
  let fence: string | undefined;
  return markdown
    .split('\n')
    .map((line) => {
      const marker = FENCE.exec(line)?.[1];
      if (fence !== undefined) {
        const closes =
          marker !== undefined &&
          marker.startsWith(fence[0] ?? '') &&
          marker.length >= fence.length &&
          line.trim() === marker;
        if (closes) {
          fence = undefined;
        }
        return blankOut(line);
      }
      if (marker !== undefined) {
        fence = marker;
        return blankOut(line);
      }
      return line.replace(/(`+)[\s\S]*?\1/g, blankOut);
    })
    .join('\n');
}

/** The anchor GitHub gives a heading. */
export function slugify(heading: string): string {
  return heading
    .trim()
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** Every heading anchor in a Markdown file, with GitHub's suffixes for repeated headings. */
export function headingAnchors(markdown: string): Set<string> {
  const anchors = new Set<string>();
  const seen = new Map<string, number>();
  let fence: string | undefined;
  for (const line of markdown.split('\n')) {
    const marker = FENCE.exec(line)?.[1];
    if (fence !== undefined) {
      if (marker !== undefined && marker.startsWith(fence[0] ?? '') && line.trim() === marker) {
        fence = undefined;
      }
      continue;
    }
    if (marker !== undefined) {
      fence = marker;
      continue;
    }
    const heading = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line)?.[1];
    if (heading === undefined) {
      continue;
    }
    const slug = slugify(heading);
    const count = seen.get(slug) ?? 0;
    anchors.add(count === 0 ? slug : `${slug}-${String(count)}`);
    seen.set(slug, count + 1);
  }
  return anchors;
}

function checkLinks(file: string, text: string, docs: DocSet, findings: DocFinding[]): void {
  const link = /!?\[(?:[^\]\\]|\\.)*\]\(([^)\s]*)(?:\s+"[^"]*")?\)/g;
  for (const match of maskCode(text).matchAll(link)) {
    const target = match[1] ?? '';
    const report = (message: string): void => {
      findings.push({ file, ...positionAt(text, match.index), message });
    };
    if (target === '') {
      report('a link with no target');
      continue;
    }
    if (EXTERNAL_LINK.test(target)) {
      continue;
    }
    const hash = target.indexOf('#');
    const rawPath = hash === -1 ? target : target.slice(0, hash);
    const anchor = hash === -1 ? undefined : target.slice(hash + 1);
    let path: string;
    try {
      path = decodeURIComponent(rawPath);
    } catch {
      report(`link to ${target}: the path is not valid`);
      continue;
    }
    let resolved = file;
    if (path !== '') {
      resolved = normalize(path.startsWith('/') ? path.slice(1) : join(dirname(file), path));
      if (!docs.exists(resolved)) {
        report(`link to ${target}: there is no ${resolved}`);
        continue;
      }
    }
    if (anchor === undefined || !resolved.endsWith('.md')) {
      continue;
    }
    const targetText = docs.markdown.get(resolved);
    if (targetText !== undefined && !headingAnchors(targetText).has(anchor)) {
      report(`link to ${target}: ${resolved} has no heading with the anchor #${anchor}`);
    }
  }
}

interface Definition {
  file: string;
  line: number;
}

function collectDefinitions(docs: DocSet, findings: DocFinding[]): Map<string, Definition> {
  const definitions = new Map<string, Definition>();
  const define = (id: string, file: string, text: string, index: number): void => {
    const position = positionAt(text, index);
    const first = definitions.get(id);
    if (first === undefined) {
      definitions.set(id, { file, line: position.line });
      return;
    }
    findings.push({
      file,
      ...position,
      message: `${id} is defined twice; it is first defined at ${first.file}:${String(first.line)}`,
    });
  };
  for (const [file, text] of docs.markdown) {
    if (!file.startsWith(SPEC_DIR)) {
      continue;
    }
    const masked = maskCode(text);
    for (const match of masked.matchAll(new RegExp(`\\*\\*(${REQUIREMENT})\\b`, 'g'))) {
      define(match[1] ?? '', file, text, match.index + 2);
    }
    for (const match of masked.matchAll(new RegExp(`^\\|\\s*(${DIAGNOSTIC})\\s*\\|`, 'gm'))) {
      const id = match[1] ?? '';
      define(id, file, text, match.index + match[0].indexOf(id));
    }
  }
  return definitions;
}

function checkCitations(
  file: string,
  text: string,
  pattern: RegExp,
  definitions: ReadonlyMap<string, Definition>,
  findings: DocFinding[],
): void {
  for (const match of text.matchAll(pattern)) {
    const id = match[0];
    if (!definitions.has(id)) {
      findings.push({
        file,
        ...positionAt(text, match.index),
        message: `${id} is cited but not defined in ${SPEC_DIR}`,
      });
    }
  }
}

/** Checks links, id definitions and id citations across a set of documents and sources. */
export function checkDocs(docs: DocSet): DocFinding[] {
  const findings: DocFinding[] = [];
  const definitions = collectDefinitions(docs, findings);
  const requirement = new RegExp(`\\b${REQUIREMENT}\\b`, 'g');
  const diagnostic = new RegExp(`\\b${DIAGNOSTIC}\\b`, 'g');
  for (const [file, text] of docs.markdown) {
    checkLinks(file, text, docs, findings);
    // Definitions cite themselves, so citations are read from the text with definitions removed.
    const masked = maskCode(text)
      .replace(new RegExp(`\\*\\*${REQUIREMENT}\\b`, 'g'), blankOut)
      .replace(new RegExp(`^\\|\\s*${DIAGNOSTIC}\\s*\\|`, 'gm'), blankOut);
    checkCitations(file, masked, requirement, definitions, findings);
    checkCitations(file, masked, diagnostic, definitions, findings);
    if (file.startsWith(SPEC_DIR)) {
      for (const match of masked.matchAll(AVOIDED_WORDS)) {
        findings.push({
          file,
          ...positionAt(text, match.index),
          message: `"${match[0]}" is on the glossary's list of words to avoid (GLOSSARY.md)`,
        });
      }
    }
  }
  for (const [file, text] of docs.code) {
    checkCitations(file, text, requirement, definitions, findings);
    checkCitations(file, text, diagnostic, definitions, findings);
  }
  return findings.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column,
  );
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
  const code = new Map<string, string>();
  for (const file of repoFiles()) {
    const isMarkdown = file.endsWith('.md');
    const isCode = /^(?:src|tests|scripts)\/.*\.ts$/.test(file);
    if (!isMarkdown && !isCode) {
      continue;
    }
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue; // deleted in the working tree but still tracked
    }
    (isMarkdown ? markdown : code).set(file, text);
  }
  const findings = checkDocs({ markdown, code, exists: existsSync });
  for (const { file, line, column, message } of findings) {
    console.error(`${file}:${String(line)}:${String(column)} ${message}`);
  }
  if (findings.length > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  main();
}
