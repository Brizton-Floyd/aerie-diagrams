// The hosts an environment value names (DRIFT-110): URLs (`http://core:8002`, several hosts as in
// `mongodb://a:1,b:2/db`), JDBC URLs (`jdbc:postgresql://db:5432/app`, Oracle's
// `jdbc:oracle:thin:@db:1521:app`) and bare host names (`rabbit`, `kafka:9092`, lists of them).
// Which of them are services, and whether a bare name counts, is the caller's call.

export interface HostMention {
  kind: 'url' | 'jdbc' | 'host';
  /** Lower case, without brackets. */
  host: string;
  /** Whether a port follows the host. */
  port: boolean;
}

const URL_END = /[\s'"<>;)]/;
const ORACLE = /jdbc:oracle:[a-z]+:[^@\s]*@(?:\/\/)?(\[[^\]]+\]|[A-Za-z0-9._-]+)(:\d+)?/gi;
const BARE = /^(\[[^\]]+\]|[A-Za-z0-9][A-Za-z0-9._-]*)(?::(\d+))?$/;

/** Every host a value names, in the order written. */
export function hostsIn(value: string): HostMention[] {
  const found: { at: number; mention: HostMention }[] = [];
  const covered: [number, number][] = [];
  for (const match of value.matchAll(ORACLE)) {
    const [all, host = '', port] = match;
    found.push({ at: match.index, mention: { kind: 'jdbc', host: hostName(host), port: !!port } });
    covered.push([match.index, match.index + all.length]);
  }
  for (let at = value.indexOf('://'); at >= 0; at = value.indexOf('://', at + 3)) {
    let start = at;
    while (start > 0 && /[A-Za-z0-9+.:-]/.test(value[start - 1] ?? '')) start--;
    const scheme = value.slice(start, at);
    if (!/^[A-Za-z]/.test(scheme)) continue;
    let end = at + 3;
    while (
      end < value.length &&
      !URL_END.test(value[end] ?? '') &&
      !'/?#'.includes(value[end] ?? '')
    ) {
      end++;
    }
    const authority = value.slice(at + 3, end);
    while (end < value.length && !URL_END.test(value[end] ?? '') && value[end] !== ',') end++;
    covered.push([start, end]);
    const kind = scheme.toLowerCase().startsWith('jdbc:') ? 'jdbc' : 'url';
    const hosts = authority.slice(authority.lastIndexOf('@') + 1);
    for (const each of hosts.split(',')) {
      const match = BARE.exec(each);
      if (match === null) continue;
      found.push({
        at: start,
        mention: { kind, host: hostName(match[1] ?? ''), port: !!match[2] },
      });
    }
  }
  let rest = value;
  for (const [from, to] of covered) {
    rest = rest.slice(0, from) + ' '.repeat(to - from) + rest.slice(to);
  }
  const tokens = /[^\s,;]+/g;
  for (const token of rest.matchAll(tokens)) {
    const match = BARE.exec(token[0]);
    if (match === null) continue;
    found.push({
      at: token.index,
      mention: { kind: 'host', host: hostName(match[1] ?? ''), port: !!match[2] },
    });
  }
  return found.sort((a, b) => a.at - b.at).map((each) => each.mention);
}

function hostName(host: string): string {
  return host.replace(/^\[|\]$/g, '').toLowerCase();
}

/** Hosts that always mean the container itself. */
export const LOOPBACK = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '::']);

/**
 * DRIFT-110: the variable names under which a bare service name, without a port, counts as naming
 * that service. A bare word elsewhere (`SPRING_PROFILES_ACTIVE: core`) is not a host.
 */
export const HOST_KEY =
  /HOST|ADDR|SERVER|BROKER|ENDPOINT|URL|URI|BOOTSTRAP|NODE|PEER|UPSTREAM|BACKEND|TARGET|DSN|CONTACT|CLUSTER/i;

/** A value with passwords and tokens hidden, so evidence never prints a secret (DRIFT-111). */
export function hideSecrets(value: string): string {
  return value
    .replace(/(:\/\/[^/@\s:]*:)[^@\s/]*@/g, '$1***@')
    .replace(/\b(password|passwd|pwd|secret|token|apikey|api_key)=([^;&\s]+)/gi, '$1=***');
}
