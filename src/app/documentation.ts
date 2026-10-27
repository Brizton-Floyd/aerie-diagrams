// Reader documentation (INT-1031 and INT-1032). This is a deliberately small Markdown subset,
// rendered with DOM nodes only: model text is never interpreted as HTML.

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  children: readonly Node[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const child of children) node.appendChild(child);
  return node;
}

/** The permitted link destinations: web, email, fragments, and ordinary relative paths. */
function destination(value: string): { href: string; external: boolean } | null {
  const href = value.trim();
  // Backslashes can become URL separators; controls and spaces can disguise a scheme.
  if (href === '' || href.startsWith('//')) return null;
  for (const char of href)
    if (char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127 || char === '\\') return null;
  const scheme = /^([^/?#]*):/.exec(href)?.[1]?.toLowerCase();
  if (scheme === undefined) return { href, external: false };
  if (!['https', 'http', 'mailto'].includes(scheme)) return null;
  try {
    const parsed = new URL(href);
    if (parsed.protocol !== `${scheme}:`) return null;
    return { href, external: true };
  } catch {
    return null;
  }
}

/** Reads one [label](destination), including balanced parentheses in its destination. */
function linkAt(text: string, from: number): { label: string; href: string; end: number } | null {
  const middle = text.indexOf('](', from + 1);
  if (middle < 0 || text.slice(from + 1, middle).includes('\n')) return null;
  let depth = 1;
  for (let at = middle + 2; at < text.length; at++) {
    const char = text[at];
    if (char === '\n') return null;
    if (char === '(') depth++;
    if (char !== ')') continue;
    depth--;
    if (depth === 0)
      return {
        label: text.slice(from + 1, middle),
        href: text.slice(middle + 2, at),
        end: at + 1,
      };
  }
  return null;
}

function inline(text: string, depth: number, links: boolean): Node[] {
  if (depth > 8) return [document.createTextNode(text)];
  const out: Node[] = [];
  let plain = '';
  const flush = (): void => {
    if (plain === '') return;
    out.push(document.createTextNode(plain));
    plain = '';
  };
  for (let at = 0; at < text.length;) {
    const char = text[at] ?? '';
    const next = text[at + 1] ?? '';
    if (char === '\\' && next !== '' && '\\`*[]()!#_'.includes(next)) {
      plain += next;
      at += 2;
      continue;
    }
    if (char === '`') {
      const end = text.indexOf('`', at + 1);
      const content = text.slice(at + 1, end);
      if (end > at + 1 && !content.includes('\n')) {
        flush();
        out.push(element('code', [document.createTextNode(content)]));
        at = end + 1;
        continue;
      }
    }
    if (char === '*') {
      const marker = next === '*' ? '**' : '*';
      const end = text.indexOf(marker, at + marker.length);
      const content = text.slice(at + marker.length, end);
      if (end > at + marker.length && !content.includes('\n')) {
        flush();
        out.push(element(marker === '**' ? 'strong' : 'em', inline(content, depth + 1, links)));
        at = end + marker.length;
        continue;
      }
    }
    if (links && char === '[' && text[at - 1] !== '!') {
      const found = linkAt(text, at);
      const target = found === null ? null : destination(found.href);
      if (found !== null && found.label !== '' && target !== null) {
        flush();
        const anchor = element('a', inline(found.label, depth + 1, false));
        anchor.setAttribute('class', 'doc-link');
        anchor.setAttribute('href', target.href);
        if (target.external) {
          anchor.setAttribute('target', '_blank');
          anchor.setAttribute('rel', 'noopener noreferrer');
        }
        out.push(anchor);
        at = found.end;
        continue;
      }
    }
    plain += char;
    at++;
  }
  flush();
  return out;
}

/** Bold, emphasis, inline code, and safe links; all other text stays literal. */
export function inlineProse(text: string): Node[] {
  return inline(text, 0, true);
}

const FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*([\w+-]*)[ \t]*$/;
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.+)$/;
const ITEM = /^ {0,3}([-+*]|\d+[.)])[ \t]+(.+)$/;

/**
 * Renders paragraphs, headings, flat lists, and fenced code in a details panel. Authored heading
 * levels start at h2, below the panel title; existing paragraphs keep their caller's classes.
 */
export function documentation(text: string | null, className = 'about'): HTMLElement[] {
  if (text === null || text.trim() === '') return [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: HTMLElement[] = [];
  const add = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    children: readonly Node[],
    kind = '',
  ): HTMLElementTagNameMap[K] => {
    const node = element(tag, children);
    node.setAttribute('class', [className, kind].filter(Boolean).join(' '));
    out.push(node);
    return node;
  };
  for (let at = 0; at < lines.length;) {
    const line = lines[at] ?? '';
    if (line.trim() === '') {
      at++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence !== null) {
      const marker = fence[1] ?? '```';
      const content: string[] = [];
      at++;
      while (at < lines.length) {
        const candidate = (lines[at] ?? '').trim();
        if (
          candidate.length >= marker.length &&
          candidate === marker.charAt(0).repeat(candidate.length)
        ) {
          at++;
          break;
        }
        content.push(lines[at] ?? '');
        at++;
      }
      const code = element('code', [document.createTextNode(content.join('\n'))]);
      if (fence[2] !== '') code.setAttribute('data-language', fence[2] ?? '');
      const pre = add('pre', [code], 'doc-code');
      pre.setAttribute('tabindex', '0');
      pre.setAttribute('role', 'region');
      pre.setAttribute('aria-label', 'Code example');
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading !== null) {
      const tag = `h${String(Math.min(6, (heading[1]?.length ?? 1) + 1))}` as
        'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      add(tag, inlineProse(heading[2] ?? ''), 'doc-heading');
      at++;
      continue;
    }
    const item = ITEM.exec(line);
    if (item !== null) {
      const ordered = /^\d/.test(item[1] ?? '');
      const list = add(ordered ? 'ol' : 'ul', [], 'doc-list');
      const start = Number.parseInt(item[1] ?? '', 10);
      if (ordered && start !== 1 && Number.isSafeInteger(start))
        list.setAttribute('start', String(start));
      while (at < lines.length) {
        const next = ITEM.exec(lines[at] ?? '');
        if (next === null || /^\d/.test(next[1] ?? '') !== ordered) break;
        list.appendChild(element('li', inlineProse(next[2] ?? '')));
        at++;
        // Lines stores each > line as a paragraph. Consecutive authored list items may therefore
        // be separated by blank lines even though they belong to the same flat list.
        let following = at;
        while (following < lines.length && (lines[following] ?? '').trim() === '') following++;
        const followingItem = ITEM.exec(lines[following] ?? '');
        if (followingItem !== null && /^\d/.test(followingItem[1] ?? '') === ordered)
          at = following;
      }
      continue;
    }
    const paragraph = [line];
    at++;
    while (at < lines.length) {
      const next = lines[at] ?? '';
      if (next.trim() === '' || FENCE.test(next) || HEADING.test(next) || ITEM.test(next)) break;
      paragraph.push(next);
      at++;
    }
    add('p', inlineProse(paragraph.join('\n')));
  }
  return out;
}
