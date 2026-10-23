// Paths as the extractor sees them: absolute, with forward slashes, on any platform (a Windows
// path is `C:/work/shop`). Pure string work, so the extractor never touches the file system.

/** Whether a path is absolute: `/srv/shop` or `C:/work/shop`. */
export function isAbsolute(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:\//.test(path);
}

/** A path with `.` and `..` parts and repeated or trailing slashes removed. */
export function normalize(path: string): string {
  const root = /^[A-Za-z]:\//.test(path) ? path.slice(0, 3) : path.startsWith('/') ? '/' : '';
  const parts: string[] = [];
  for (const part of path.slice(root.length).split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..' && parts.length > 0 && parts.at(-1) !== '..') parts.pop();
    else if (part !== '..' || root === '') parts.push(part);
  }
  const joined = root + parts.join('/');
  return joined === '' ? '.' : joined;
}

/** `path` read from the folder `base`, unless it is absolute already. */
export function resolve(base: string, path: string): string {
  return normalize(isAbsolute(path) ? path : `${base}/${path}`);
}

/** The folder that holds a path. */
export function dirname(path: string): string {
  const at = path.lastIndexOf('/');
  if (at < 0) return '.';
  if (at === 0) return '/';
  if (at === 2 && /^[A-Za-z]:/.test(path)) return path.slice(0, 3);
  return path.slice(0, at);
}

/** The last part of a path. */
export function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Whether `path` is the folder `folder` or inside it. */
export function isInside(folder: string, path: string): boolean {
  return path === folder || path.startsWith(folder.endsWith('/') ? folder : `${folder}/`);
}

/** The path from `folder` to `path`, which is inside it: `.` for the folder itself. */
export function inside(folder: string, path: string): string {
  if (path === folder) return '.';
  return path.slice(folder.endsWith('/') ? folder.length : folder.length + 1);
}
