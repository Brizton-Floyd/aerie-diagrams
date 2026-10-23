// Compose interpolation (DRIFT-102): `$VAR`, `${VAR}`, `${VAR:-default}`, `${VAR-default}`,
// `${VAR:?error}`, `${VAR?error}`, `${VAR:+replacement}`, `${VAR+replacement}`, nested defaults,
// and `$$` for a literal `$`. Values come only from the project's `.env` file, never from the
// environment drift runs in, and nothing is ever executed.

export interface Interpolated {
  text: string;
  /** Variables used without a default that have no value, in the order met. */
  unset: string[];
}

const NAME = /[A-Za-z_][A-Za-z0-9_]*/y;
const OPERATORS = [':-', ':?', ':+', '-', '?', '+'] as const;

/** `text` with every variable replaced, as Compose replaces it. */
export function interpolate(text: string, vars: ReadonlyMap<string, string>): Interpolated {
  const unset: string[] = [];
  const out = substitute(text, vars, unset);
  return { text: out, unset };
}

function substitute(text: string, vars: ReadonlyMap<string, string>, unset: string[]): string {
  let out = '';
  let at = 0;
  while (at < text.length) {
    const dollar = text.indexOf('$', at);
    if (dollar < 0) {
      out += text.slice(at);
      break;
    }
    out += text.slice(at, dollar);
    const next = text[dollar + 1];
    if (next === '$') {
      out += '$';
      at = dollar + 2;
      continue;
    }
    if (next === '{') {
      const braced = readBraced(text, dollar + 2);
      if (braced === null) {
        out += '$';
        at = dollar + 1;
        continue;
      }
      out += resolveBraced(braced, vars, unset);
      at = braced.end;
      continue;
    }
    NAME.lastIndex = dollar + 1;
    const name = NAME.exec(text);
    if (name === null) {
      out += '$';
      at = dollar + 1;
      continue;
    }
    out += lookup(name[0], vars, unset);
    at = dollar + 1 + name[0].length;
  }
  return out;
}

interface Braced {
  name: string;
  operator: (typeof OPERATORS)[number] | null;
  argument: string;
  /** Just after the closing brace. */
  end: number;
}

/** `${...}` starting just after the brace, or null when it is not a valid variable. */
function readBraced(text: string, start: number): Braced | null {
  NAME.lastIndex = start;
  const name = NAME.exec(text);
  if (name === null) return null;
  let at = start + name[0].length;
  if (text[at] === '}') return { name: name[0], operator: null, argument: '', end: at + 1 };
  const operator = OPERATORS.find((each) => text.startsWith(each, at));
  if (operator === undefined) return null;
  at += operator.length;
  const from = at;
  let depth = 0;
  for (; at < text.length; at++) {
    if (text[at] === '$' && text[at + 1] === '{') {
      depth++;
      at++;
    } else if (text[at] === '}') {
      if (depth === 0) {
        return { name: name[0], operator, argument: text.slice(from, at), end: at + 1 };
      }
      depth--;
    }
  }
  return null;
}

function resolveBraced(braced: Braced, vars: ReadonlyMap<string, string>, unset: string[]): string {
  const value = vars.get(braced.name);
  const set = value !== undefined;
  const filled = set && value !== '';
  const argument = (): string => substitute(braced.argument, vars, unset);
  switch (braced.operator) {
    case null:
      return lookup(braced.name, vars, unset);
    case ':-':
      return filled ? value : argument();
    case '-':
      return set ? value : argument();
    case ':?':
      if (filled) return value;
      if (!unset.includes(braced.name)) unset.push(braced.name);
      return '';
    case '?':
      return set ? value : lookup(braced.name, vars, unset);
    case ':+':
      return filled ? argument() : '';
    case '+':
      return set ? argument() : '';
  }
}

function lookup(name: string, vars: ReadonlyMap<string, string>, unset: string[]): string {
  const value = vars.get(name);
  if (value !== undefined) return value;
  if (!unset.includes(name)) unset.push(name);
  return '';
}
