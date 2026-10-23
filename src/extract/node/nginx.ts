// nginx configuration, as far as drift needs it (DRIFT-308, DRIFT-309): the `server` blocks an image
// serves, their `location` blocks and where each one's `proxy_pass` sends calls. Aerie reads it
// itself: a small tokenizer that keeps the file and line of every directive (no npm parser does),
// `include` followed through the files the image holds, `set` variables and `upstream` blocks, and
// templates filled in from the container's environment as the nginx image does when it starts.
import { basename } from '../paths.ts';

export interface Directive {
  name: string;
  args: string[];
  /** The file it is written in: absolute, in the system. */
  file: string;
  line: number;
  /** The directives inside its `{ }`, or null for a simple directive. */
  block: Directive[] | null;
}

/** Reads nginx configuration text into directives. Comments and quotes are handled; nothing is checked. */
export function parseNginx(text: string, file: string): Directive[] {
  const root: Directive[] = [];
  const stack: Directive[][] = [root];
  let words: { text: string; line: number }[] = [];
  let line = 1;
  const flush = (block: Directive[] | null): void => {
    const [name, ...args] = words;
    if (name !== undefined) {
      stack.at(-1)?.push({
        name: name.text,
        args: args.map((each) => each.text),
        file,
        line: name.line,
        block,
      });
    }
    words = [];
  };
  for (let i = 0; i < text.length;) {
    const char = text[i] ?? '';
    if (char === '\n') {
      line++;
      i++;
    } else if (/\s/.test(char)) {
      i++;
    } else if (char === '#') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (char === ';') {
      flush(null);
      i++;
    } else if (char === '{') {
      const block: Directive[] = [];
      flush(block);
      stack.push(block);
      i++;
    } else if (char === '}') {
      flush(null);
      if (stack.length > 1) stack.pop();
      i++;
    } else {
      const start = line;
      let word = '';
      while (i < text.length) {
        const here = text[i] ?? '';
        if (here === '"' || here === "'") {
          i++;
          while (i < text.length && text[i] !== here) {
            if (text[i] === '\\' && i + 1 < text.length) i++;
            if (text[i] === '\n') line++;
            word += text[i] ?? '';
            i++;
          }
          i++;
        } else if (here === '$' && text[i + 1] === '{') {
          const close = text.indexOf('}', i);
          const end = close < 0 ? text.length : close + 1;
          word += text.slice(i, end);
          i = end;
        } else if (/[\s;{}]/.test(here)) {
          break;
        } else {
          word += here;
          i++;
        }
      }
      words.push({ text: word, line: start });
    }
  }
  flush(null);
  return root;
}

/**
 * A template filled in as the nginx image's `envsubst` does: `${NAME}` and `$NAME` are replaced for
 * every variable the container's environment defines, and left alone otherwise.
 */
export function envsubst(text: string, environment: ReadonlyMap<string, string>): string {
  return text.replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
    (all, braced: string | undefined, bare: string | undefined) =>
      environment.get(braced ?? bare ?? '') ?? all,
  );
}

/** A file the image holds, at its path in the container. */
export interface ImageEntry {
  /** In the container: absolute. */
  path: string;
  /** In the system: absolute. */
  source: string;
}

/** The nginx image's defaults for its templates (the entrypoint's environment variables). */
export function templateSettings(environment: ReadonlyMap<string, string>): {
  folder: string;
  suffix: string;
  output: string;
} {
  const trim = (path: string): string => path.replace(/\/+$/, '');
  return {
    folder: trim(environment.get('NGINX_ENVSUBST_TEMPLATE_DIR') ?? '/etc/nginx/templates'),
    suffix: environment.get('NGINX_ENVSUBST_TEMPLATE_SUFFIX') ?? '.template',
    output: trim(environment.get('NGINX_ENVSUBST_OUTPUT_DIR') ?? '/etc/nginx/conf.d'),
  };
}

export interface Location {
  modifier: '' | '=' | '~' | '~*' | '^~';
  uri: string;
  directive: Directive;
  nested: Location[];
  /** The `proxy_pass` directive inside it, outside its nested locations. */
  proxy: Directive | null;
  /** Its `set` variables, without the `$`. */
  sets: Map<string, string>;
}

export interface Server {
  locations: Location[];
  sets: Map<string, string>;
}

export interface NginxConfig {
  servers: Server[];
  /** Each `upstream` block's servers, as `host:port` or `host`. */
  upstreams: Map<string, string[]>;
}

/**
 * The configuration an nginx image serves: its own `nginx.conf` if the image holds one, or else, as
 * the image's default does, every `/etc/nginx/conf.d/*.conf`; `include` is followed through the
 * files the image holds. `read` gives a file's text by its path in the container.
 */
export function nginxConfig(
  paths: readonly string[],
  read: (path: string) => { text: string; file: string } | undefined,
): NginxConfig {
  const roots = paths.includes('/etc/nginx/nginx.conf')
    ? ['/etc/nginx/nginx.conf']
    : paths.filter((path) => /^\/etc\/nginx\/conf\.d\/[^/]+\.conf$/.test(path)).sort();
  const seen = new Set<string>();
  const load = (path: string): Directive[] => {
    if (seen.has(path)) return [];
    seen.add(path);
    const found = read(path);
    if (found === undefined) return [];
    return expand(parseNginx(found.text, found.file));
  };
  const expand = (directives: Directive[]): Directive[] =>
    directives.flatMap((directive) => {
      if (directive.name === 'include' && directive.block === null) {
        const pattern = includePattern(directive.args[0] ?? '');
        return paths
          .filter((path) => pattern.test(path))
          .sort()
          .flatMap(load);
      }
      return [
        directive.block === null ? directive : { ...directive, block: expand(directive.block) },
      ];
    });
  const tree = roots.flatMap(load);
  const config: NginxConfig = { servers: [], upstreams: new Map() };
  const walk = (directives: Directive[]): void => {
    for (const directive of directives) {
      if (directive.block === null) continue;
      if (directive.name === 'upstream') {
        const servers = directive.block
          .filter((each) => each.name === 'server')
          .flatMap((each) => (each.args[0] === undefined ? [] : [each.args[0]]));
        config.upstreams.set(directive.args[0] ?? '', servers);
      } else if (directive.name === 'server') {
        config.servers.push({
          locations: locations(directive.block),
          sets: sets(directive.block),
        });
      } else {
        walk(directive.block);
      }
    }
  };
  walk(tree);
  return config;
}

/** An `include` argument as a pattern over the paths in the container, from `/etc/nginx`. */
function includePattern(arg: string): RegExp {
  const path = arg.startsWith('/') ? arg : `/etc/nginx/${arg}`;
  const pattern = path
    .split('')
    .map((char) =>
      char === '*' ? '[^/]*' : char === '?' ? '[^/]' : char.replace(/[.+^$(){}|[\]\\]/g, '\\$&'),
    )
    .join('');
  return new RegExp(`^${pattern}$`);
}

function sets(block: readonly Directive[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const directive of block) {
    const [name, value] = directive.args;
    if (directive.name === 'set' && name?.startsWith('$') && value !== undefined) {
      out.set(name.slice(1), value);
    }
  }
  return out;
}

function locations(block: readonly Directive[]): Location[] {
  return block.flatMap((directive) => {
    if (directive.name !== 'location' || directive.block === null) return [];
    const [first = '', second] = directive.args;
    const modifiers = ['=', '~', '~*', '^~'];
    const modifier = (modifiers.includes(first) ? first : '') as Location['modifier'];
    const uri = modifier === '' ? first : (second ?? '');
    if (uri.startsWith('@')) return [];
    const inner = directive.block;
    const proxy = findProxy(inner);
    return [{ modifier, uri, directive, nested: locations(inner), proxy, sets: sets(inner) }];
  });
}

/** The `proxy_pass` in a location, also inside its `if` and `limit_except` blocks. */
function findProxy(block: readonly Directive[]): Directive | null {
  for (const directive of block) {
    if (directive.name === 'proxy_pass') return directive;
    if (directive.block !== null && directive.name !== 'location') {
      const inner = findProxy(directive.block);
      if (inner !== null) return inner;
    }
  }
  return null;
}

/**
 * The location nginx picks for a request path: an exact match, else the longest prefix if it is
 * `^~`, else the first regular expression that matches, else the longest prefix (its nested
 * locations first).
 */
export function selectLocation(locations: readonly Location[], path: string): Location | null {
  const exact = locations.find((each) => each.modifier === '=' && each.uri === path);
  if (exact !== undefined) return exact;
  let longest: Location | null = null;
  for (const each of locations) {
    if (each.modifier !== '' && each.modifier !== '^~') continue;
    if (path.startsWith(each.uri) && (longest === null || each.uri.length > longest.uri.length)) {
      longest = each;
    }
  }
  const deeper = (found: Location): Location => selectLocation(found.nested, path) ?? found;
  if (longest?.modifier === '^~') return deeper(longest);
  for (const each of locations) {
    if (each.modifier !== '~' && each.modifier !== '~*') continue;
    try {
      if (new RegExp(each.uri, each.modifier === '~*' ? 'i' : '').test(path)) return each;
    } catch {
      continue;
    }
  }
  return longest === null ? null : deeper(longest);
}

/**
 * Where a location's `proxy_pass` sends calls: one URL, or one per server of the `upstream` it
 * names. `unknown` names a variable in the address that nothing sets.
 */
export function proxyTargets(
  location: Location,
  server: Server,
  upstreams: ReadonlyMap<string, string[]>,
): { urls: string[] } | { unknown: string } {
  let target = location.proxy?.args[0] ?? '';
  for (let round = 0; round < 5 && target.includes('$'); round++) {
    target = target.replace(
      /\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
      (all, braced: string | undefined, bare: string | undefined) => {
        const name = braced ?? bare ?? '';
        return location.sets.get(name) ?? server.sets.get(name) ?? all;
      },
    );
  }
  const match = /^([A-Za-z][A-Za-z0-9+.-]*:\/\/)?([^/?#]*)(.*)$/.exec(target);
  const scheme = match?.[1] ?? 'http://';
  const address = match?.[2] ?? '';
  const variable = /\$\{?([A-Za-z_][A-Za-z0-9_]*)/.exec(address);
  if (variable !== null) return { unknown: `$${variable[1] ?? ''}` };
  const upstream = upstreams.get(address);
  if (upstream !== undefined) {
    return { urls: upstream.map((server) => `${scheme}${server}${match?.[3] ?? ''}`) };
  }
  return { urls: [match?.[1] === undefined ? `${scheme}${target}` : target] };
}

/** The path in the container a file lands at, from one copy into the image. */
export function landsAt(source: string, destination: string, many: boolean): string {
  if (many || destination.endsWith('/'))
    return `${destination.replace(/\/?$/, '/')}${basename(source)}`;
  return destination;
}
