// The Angular dev server's proxy file (DRIFT-304): which request paths `ng serve` forwards, and
// where. A `.json` file is read as JSON with comments, in either form the Angular CLI accepts (an
// object of contexts, or an array of entries with a `context`); any other file is a module the CLI
// imports, which drift never runs. A context is matched as the dev server matches it: from `^` a
// regular expression, a glob pattern as a glob, anything else as a prefix of the path.
import type { Node } from 'jsonc-parser';
import { at, items, members, text, type Json } from './json.ts';

export interface ProxyRoute {
  context: string;
  /** Where it sends calls, as written. */
  target: string;
  /** The line of the target. */
  line: number;
  matches(path: string): boolean;
}

/** The routes of a proxy file, in order. */
export function readProxy(json: Json): ProxyRoute[] {
  const routes: ProxyRoute[] = [];
  const add = (context: string, value: Node): void => {
    const found = targetOf(value);
    if (found === null) return;
    routes.push({
      context,
      target: found.target,
      line: json.line(found.node.offset),
      matches: matcher(context),
    });
  };
  if (json.root.type === 'array') {
    for (const entry of items(json.root)) {
      const context = at(entry, 'context');
      const contexts = context?.type === 'array' ? items(context).map(text) : [text(context)];
      for (const each of contexts) if (each !== undefined) add(each, entry);
    }
  } else {
    for (const { key, value } of members(json.root)) add(key, value);
  }
  return routes;
}

/** An entry's target: a string, or an object with a `target` string or `host`, `port` and `protocol`. */
function targetOf(value: Node): { target: string; node: Node } | null {
  const direct = text(value);
  if (direct !== undefined) return { target: direct, node: value };
  const target = at(value, 'target');
  const written = text(target);
  if (target !== undefined && written !== undefined) return { target: written, node: target };
  const host = text(at(target, 'host'));
  if (target === undefined || host === undefined) return null;
  const protocol = text(at(target, 'protocol')) ?? 'http:';
  const port = at(target, 'port');
  const portText = port === undefined ? '' : `:${String(port.value)}`;
  return { target: `${protocol.replace(/:?$/, ':')}//${host}${portText}`, node: target };
}

/** Whether a context is a glob pattern rather than a plain path. */
function isPattern(context: string): boolean {
  return /[*?[\]{}]|[!@+]\(/.test(context);
}

function matcher(context: string): (path: string) => boolean {
  if (context.startsWith('^')) {
    try {
      const pattern = new RegExp(context);
      return (path) => pattern.test(path);
    } catch {
      return () => false;
    }
  }
  if (isPattern(context)) {
    const pattern = globPattern(context);
    return (path) => pattern.test(path);
  }
  return (path) => path.startsWith(context);
}

/** A glob as a regular expression over a request path: `**` any folders, `*` and `?` within one. */
export function globPattern(glob: string): RegExp {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i] ?? '';
    if (char === '*' && glob[i + 1] === '*') {
      const folder = glob[i + 2] === '/';
      out += folder ? '(?:.*/)?' : '.*';
      i += folder ? 2 : 1;
    } else if (char === '*') {
      out += '[^/]*';
    } else if (char === '?') {
      out += '[^/]';
    } else if (char === '{') {
      const close = glob.indexOf('}', i);
      if (close < 0) {
        out += '\\{';
        continue;
      }
      const options = glob.slice(i + 1, close).split(',');
      out += `(?:${options.map((each) => each.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('|')})`;
      i = close;
    } else {
      out += char.replace(/[.+^$(){}|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${out}(?:\\?.*)?$`);
}
