// A module's Spring configuration (DRIFT-205, DRIFT-206): the `application` files Spring Boot reads
// from its classpath folders, each document tagged with the profile it applies in, never merged into one
// value; placeholders filled in as Spring fills them; and relaxed binding, by which `core-api.baseUrl`,
// `core-api.base-url` and the environment variable `COREAPI_BASEURL` are one property.
import { Properties } from 'properties-file/parser';
import type { Loading } from '../compose/load.ts';
import { PROBLEMS } from '../problems.ts';
import { readYamlDocuments, type YNode } from '../yaml.ts';

export interface ConfigEntry {
  /** As written, with a YAML file's keys joined by dots and list items as `[0]`. */
  key: string;
  value: string;
  file: string;
  line: number;
  /** The profile its file or document applies in, as written; null when it always applies. */
  profile: string | null;
  /** Within one profile, the higher wins: a later document, `.properties` over YAML, `config/`. */
  rank: number;
}

const FILE = /^application(?:-(.+))?\.(properties|ya?ml)$/;

/** DRIFT-205: every entry of the configuration files in a module's classpath folders. */
export function readConfig(classpath: readonly string[], loading: Loading): Config {
  const entries: ConfigEntry[] = [];
  classpath.forEach((folder, index) => {
    [folder, `${folder}/config`].forEach((location, depth) => {
      for (const name of loading.files.list(location)) {
        const match = FILE.exec(name);
        const path = `${location}/${name}`;
        if (match === null || loading.files.isFolder(path)) continue;
        const text = loading.files.read(path);
        if (text === undefined) continue;
        loading.read.add(path);
        const properties = match[2] === 'properties';
        const rank = ((index * 2 + depth) * 2 + (properties ? 1 : 0)) * 1000;
        const documents = properties
          ? propertiesDocuments(text, path)
          : yamlDocuments(text, path, loading);
        documents.forEach((document, at) => {
          const activation = document.find(
            (each) =>
              uniform(each.key) === uniform('spring.config.activate.on-profile') ||
              uniform(each.key) === uniform('spring.profiles'),
          );
          const profile = activation?.value ?? match[1] ?? null;
          for (const each of document) entries.push({ ...each, profile, rank: rank + at });
        });
      }
    });
  });
  return new Config(entries);
}

type Written = Omit<ConfigEntry, 'profile' | 'rank'>;

/** A `.properties` file's documents, split by Spring's `#---` and `!---` lines. */
function propertiesDocuments(text: string, file: string): Written[][] {
  const documents: Written[][] = [[]];
  for (const node of new Properties(text).nodes) {
    if (node.type === 'comment') {
      if (node.body.trim() === '---') documents.push([]);
      continue;
    }
    if (node.type !== 'property') continue;
    documents
      .at(-1)
      ?.push({ key: node.key, value: node.value, file, line: node.startingLineNumber });
  }
  return documents;
}

function yamlDocuments(text: string, file: string, loading: Loading): Written[][] {
  const read = readYamlDocuments(text, file);
  const error = read.errors[0];
  if (error !== undefined) {
    loading.problems.push({
      id: 'bad-config',
      level: 'warning',
      at: loading.locator.evidence(file, error.line),
      message: PROBLEMS['bad-config'](error.message.replace(/[.:]+$/, '')),
    });
    return [];
  }
  return read.roots.map((root) => {
    const out: Written[] = [];
    if (root !== null) flatten(root, '', out);
    return out;
  });
}

function flatten(node: YNode, prefix: string, out: Written[]): void {
  if (node.type === 'map') {
    for (const entry of node.entries) {
      flatten(entry.value, prefix === '' ? entry.key : `${prefix}.${entry.key}`, out);
    }
  } else if (node.type === 'seq') {
    node.items.forEach((item, index) => {
      flatten(item, `${prefix}[${String(index)}]`, out);
    });
  } else if (node.text !== null) {
    out.push({ key: prefix, value: node.text, file: node.at.file, line: node.at.line });
  }
}

/** DRIFT-206: a property's name as relaxed binding compares it: lower case, without `-` and `_`. */
export function uniform(key: string): string {
  return key.toLowerCase().replace(/[-_]/g, '');
}

/** DRIFT-206: the environment variable that sets a property: `.` to `_`, no `-`, upper case. */
export function envName(key: string): string {
  return key
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/-/g, '')
    .replace(/\./g, '_')
    .toUpperCase();
}

/** Text with Spring's placeholders filled in, and the names of those that had no value. */
export interface Filled {
  text: string;
  unknown: string[];
}

export class Config {
  readonly entries: readonly ConfigEntry[];
  /** `spring.profiles.active` of the documents that always apply. */
  readonly active: readonly string[];

  constructor(entries: ConfigEntry[]) {
    this.entries = entries;
    const active = this.pick('spring.profiles.active', []);
    this.active =
      active === undefined
        ? []
        : active.value
            .split(',')
            .map((each) => each.trim())
            .filter((each) => each !== '');
  }

  /**
   * The entry Spring would use for a key with the active profiles (or the given ones): a profile's
   * entry over one that always applies, a later active profile over an earlier one, then by rank.
   */
  pick(key: string, profiles: readonly string[] = this.active): ConfigEntry | undefined {
    const wanted = uniform(key);
    let best: { entry: ConfigEntry; score: number } | undefined;
    for (const entry of this.entries) {
      if (uniform(entry.key) !== wanted) continue;
      const order = entry.profile === null ? 0 : profiles.indexOf(entry.profile) + 1;
      if (entry.profile !== null && order === 0) continue;
      const score = order * 1e9 + entry.rank;
      if (best === undefined || score >= best.score) best = { entry, score };
    }
    return best?.entry;
  }

  /** A key's value as the code sees it, placeholders filled in; undefined when it has none. */
  value(key: string): Filled | undefined {
    const entry = this.pick(key);
    return entry === undefined ? undefined : this.fill(entry.value, entry.profile);
  }

  /** DRIFT-206: `${key}` and `${key:default}`, nested too, filled in from this configuration. */
  fill(text: string, profile: string | null = null, seen: readonly string[] = []): Filled {
    const unknown: string[] = [];
    let out = '';
    let at = 0;
    while (at < text.length) {
      const start = text.indexOf('${', at);
      if (start < 0) break;
      const end = closing(text, start + 2);
      if (end < 0) break;
      out += text.slice(at, start);
      const inner = text.slice(start + 2, end);
      const colon = defaultColon(inner);
      const name = colon < 0 ? inner : inner.slice(0, colon);
      const fallback = colon < 0 ? null : inner.slice(colon + 1);
      const profiles = profile === null ? this.active : [...this.active, profile];
      const entry = seen.includes(uniform(name)) ? undefined : this.pick(name, profiles);
      if (entry !== undefined) {
        const filled = this.fill(entry.value, entry.profile, [...seen, uniform(name)]);
        out += filled.text;
        unknown.push(...filled.unknown);
      } else if (fallback !== null) {
        const filled = this.fill(fallback, profile, seen);
        out += filled.text;
        unknown.push(...filled.unknown);
      } else {
        out += text.slice(start, end + 1);
        unknown.push(name);
      }
      at = end + 1;
    }
    return { text: out + text.slice(at), unknown };
  }
}

/** The `}` that closes a placeholder whose name starts at `from`, past nested ones. */
function closing(text: string, from: number): number {
  let depth = 1;
  for (let i = from; i < text.length; i++) {
    if (text.startsWith('${', i)) {
      depth++;
      i++;
    } else if (text[i] === '}' && --depth === 0) {
      return i;
    }
  }
  return -1;
}

/** Where a placeholder's default starts: the first `:` outside a nested placeholder. */
function defaultColon(inner: string): number {
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    if (inner.startsWith('${', i)) {
      depth++;
      i++;
    } else if (inner[i] === '}') {
      depth--;
    } else if (inner[i] === ':' && depth === 0) {
      return i;
    }
  }
  return -1;
}
