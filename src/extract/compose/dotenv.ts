// The `.env` and `env_file` format of the Compose specification (DRIFT-103): `VAR=VAL` lines,
// comments, single quotes taken literally, double quotes with escapes, interpolation of unquoted and
// double-quoted values from the lines above (and the project's variables), and `VAR` alone, which
// leaves the variable unset. Aerie's own reader: nothing in a value is ever executed.
import { interpolate } from './interpolate.ts';

export interface EnvEntry {
  name: string;
  /** The value, or null when the line leaves the variable unset (`VAR` alone). */
  value: string | null;
  /** The line the entry starts on, counted from 1. */
  line: number;
}

export interface EnvFile {
  entries: EnvEntry[];
  /** Variables used without a default that had no value. */
  unset: string[];
}

const KEY = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', '\\': '\\', '"': '"' };

/**
 * Reads an env file. `outer` holds the variables known before it (for an `env_file`, the
 * project's); `raw` takes every value as written, as `format: raw` asks.
 */
export function readEnvFile(
  text: string,
  outer: ReadonlyMap<string, string> = new Map(),
  raw = false,
): EnvFile {
  const lines = text.split(/\r?\n/);
  const entries: EnvEntry[] = [];
  const unset: string[] = [];
  const known = new Map(outer);
  const fill = (value: string): string => {
    const done = interpolate(value, known);
    for (const name of done.unset) if (!unset.includes(name)) unset.push(name);
    return done.text;
  };
  for (let index = 0; index < lines.length; index++) {
    const line = index + 1;
    const content = (lines[index] ?? '').trimStart();
    if (content === '' || content.startsWith('#')) continue;
    const body = content.startsWith('export ') ? content.slice(7).trimStart() : content;
    const equals = body.indexOf('=');
    const name = (equals < 0 ? body : body.slice(0, equals)).trim();
    if (!KEY.test(name)) continue;
    if (equals < 0) {
      entries.push({ name, value: null, line });
      known.delete(name);
      continue;
    }
    let rest = body.slice(equals + 1).trimStart();
    let value: string;
    if (raw) {
      value = rest.trimEnd();
    } else if (rest.startsWith('"') || rest.startsWith("'")) {
      const quote = rest[0] ?? '"';
      // A quoted value may run on over the following lines.
      let close = closingQuote(rest, quote);
      while (close < 0 && index + 1 < lines.length) {
        index++;
        rest += `\n${lines[index] ?? ''}`;
        close = closingQuote(rest, quote);
      }
      const inner = rest.slice(1, close < 0 ? rest.length : close);
      value =
        quote === "'"
          ? inner.replace(/\\'/g, "'")
          : fill(inner.replace(/\\(.)/g, (all, char: string) => ESCAPES[char] ?? all));
    } else {
      const comment = rest.search(/\s#/);
      value = fill((comment < 0 ? rest : rest.slice(0, comment)).trimEnd());
    }
    entries.push({ name, value, line });
    known.set(name, value);
  }
  return { entries, unset };
}

/** Where the quote that closes `text` (which starts with one) is, or -1. */
function closingQuote(text: string, quote: string): number {
  for (let at = 1; at < text.length; at++) {
    if (text[at] === '\\') at++;
    else if (text[at] === quote) return at;
  }
  return -1;
}
