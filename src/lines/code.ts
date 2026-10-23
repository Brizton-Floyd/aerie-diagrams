// What the lines for checking against the code accept (docs/spec/language.md, section 11): the
// kinds of code unit a `code` line names, the rule for each kind's names, and the paths of the
// `system` block. Only `aerie drift` reads these lines; nothing here touches the file system.

/** LANG-756: the kinds of code unit, in the order the spec lists them. */
export const CODE_KINDS = ['compose', 'maven', 'npm', 'class'] as const;

export type CodeKind = (typeof CODE_KINDS)[number];

export function isCodeKind(word: string): word is CodeKind {
  return (CODE_KINDS as readonly string[]).includes(word);
}

/** What a name of each kind must look like, and how E808 says it (the E808 table). */
export const CODE_NAMES: Record<CodeKind, { pattern: RegExp; what: string; how: string }> = {
  compose: {
    pattern: /^[A-Za-z0-9._-]+$/,
    what: 'a Compose service',
    how: 'A service name uses letters, digits, `.`, `_` and `-`, as in `compose:orders-api`.',
  },
  maven: {
    pattern: /^[A-Za-z0-9._-]+$/,
    what: 'a Maven module',
    how: "Write the module's artifactId, which uses letters, digits, `.`, `_` and `-`, as in `maven:orders-core`.",
  },
  npm: {
    pattern: /^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/,
    what: 'an npm package',
    how: 'Write the `name` from its package.json, in lower case, as in `npm:orders-web` or `npm:@shop/orders-web`.',
  },
  class: {
    pattern: /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:\.\*)?$/,
    what: 'a class',
    how: 'Write a class name, as in `class:OrderService` or `class:com.shop.orders.OrderService`, or a package and `.*`, as in `class:com.shop.orders.*`.',
  },
};

/**
 * LANG-753: a path from the model file's folder, normalised (`./a/../b/` gives `b`, the folder
 * itself gives `.`), or null when it is not such a path: absolute, from the home folder, a web
 * address, or written with backslashes.
 */
export function relativePath(text: string): string | null {
  if (
    text.includes('\\') ||
    text.startsWith('/') ||
    text.startsWith('~') ||
    /^[A-Za-z]:/.test(text) ||
    /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(text)
  ) {
    return null;
  }
  const parts: string[] = [];
  for (const part of text.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..' && parts.length > 0 && parts.at(-1) !== '..') parts.pop();
    else parts.push(part);
  }
  return parts.length === 0 ? '.' : parts.join('/');
}

/** LANG-754: whether a normalised path is the normalised folder `folder` or inside it. */
export function isInside(path: string, folder: string): boolean {
  if (folder === '.') return path !== '..' && !path.startsWith('../');
  return path === folder || path.startsWith(`${folder}/`);
}
