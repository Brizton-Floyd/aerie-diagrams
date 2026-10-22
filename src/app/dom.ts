// A small helper for building the page's controls.

type Child = Node | string | null | false | undefined;

/** Creates an element with attributes, event handlers (`on*` functions) and children. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<
    string,
    string | number | boolean | null | undefined | ((event: Event) => void)
  > = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (typeof value === 'function') {
      node.addEventListener(name.slice(2).toLowerCase(), value);
    } else if (value === true) {
      node.setAttribute(name, '');
    } else if (value !== null && value !== undefined && value !== false) {
      node.setAttribute(name, String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === false || child === undefined) continue;
    node.append(child);
  }
  return node;
}

/** Description text with `**bold**` and `` `code` `` spans, as safe DOM nodes. */
export function prose(text: string): Node[] {
  const out: Node[] = [];
  for (const part of text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)) {
    if (part === '') continue;
    if (part.startsWith('**') && part.endsWith('**'))
      out.push(h('strong', {}, [part.slice(2, -2)]));
    else if (part.startsWith('`') && part.endsWith('`'))
      out.push(h('code', {}, [part.slice(1, -1)]));
    else out.push(document.createTextNode(part));
  }
  return out;
}
