// `aerie watch <file>` (docs/spec/interaction.md, INT-851 to INT-855): a small server on 127.0.0.1
// that serves Aerie's built page and sends it the author's file each time it is saved, for authors
// who write in their own editor. The page checks and draws each version as the split editor does;
// the terminal prints the diagnostics of every check.
import { spawn } from 'node:child_process';
import { readFile, realpath, stat } from 'node:fs/promises';
import { watch as watchFolder, type FSWatcher } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import type { WatchEvent } from '../app/watching.ts';
import type { Diagnostic } from '../lines/index.ts';
import { check } from '../model/index.ts';

/** INT-851: the port the server listens on unless `--port` gives another. */
export const WATCH_PORT = 4310;
/** INT-852: saves within this many milliseconds count as one. */
export const SETTLE = 100;
/** The address the page listens to for new versions of the file. */
export const EVENTS_PATH = '/__aerie/events';

export interface WatchOptions {
  /** The author's file, as given on the command line. */
  file: string;
  /** The port, or 0 for any free one. */
  port: number;
  /** The folder of Aerie's built page (`dist/`). */
  pages: string;
  /** Opens the address in the browser (INT-851); left out with `--no-open`. */
  open?: (url: string) => void;
  /** The terminal. */
  out: (text: string) => void;
  /** Formats one diagnostic as `aerie check` prints it (LANG-962). */
  line: (path: string, found: Diagnostic) => string;
}

export interface Watching {
  /** The address the server prints, such as `http://127.0.0.1:4310/`. */
  url: string;
  /** Stops watching and closes the server and every open page's connection. */
  close: () => Promise<void>;
}

/** Thrown when watching cannot start, with a plain-English message. */
export class CannotWatch extends Error {}

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** INT-854: why a file cannot be read, in plain words. */
export function unreadable(name: string, error: unknown): string {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  const why =
    code === 'ENOENT'
      ? 'there is no file with that name any more.'
      : code === 'EISDIR'
        ? 'it is a folder, not a file.'
        : code === 'EACCES' || code === 'EPERM'
          ? 'it is not allowed to read it.'
          : 'the file cannot be opened.';
  return `Aerie cannot read ${name}: ${why}`;
}

/** Opens an address in the system's browser, quietly doing nothing where that fails. */
export function openInBrowser(url: string): void {
  const [command, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {
      // No browser to open: the printed address is enough.
    });
    child.unref();
  } catch {
    // As above.
  }
}

/**
 * INT-851: only pages on this machine, asked for by this machine's name, may talk to the server,
 * so a web page elsewhere cannot read the author's file through a renamed address.
 */
function hostAllowed(request: IncomingMessage, port: number): boolean {
  const host = request.headers.host ?? '';
  return [`127.0.0.1:${String(port)}`, `localhost:${String(port)}`].includes(host);
}

/** Starts watching a file and serving its diagram. */
export async function watch(options: WatchOptions): Promise<Watching> {
  const { out } = options;
  const path = resolve(options.file);
  const name = basename(path);
  const pages = resolve(options.pages);
  const index = join(pages, 'index.html');
  if ((await stat(path).catch(() => null)) === null) {
    throw new CannotWatch(`There is no file called ${options.file}.`);
  }
  let page: string;
  try {
    page = await readFile(index, 'utf8');
  } catch {
    throw new CannotWatch(
      "Aerie's page is not built yet. Run npm run build in the Aerie checkout, then try again.",
    );
  }
  // The page follows the server when it finds this tag (src/app/watching.ts).
  page = page.replace(
    '</head>',
    `  <meta name="aerie-watch" content="${EVENTS_PATH}" />\n  </head>`,
  );

  const pagesOpen = new Set<ServerResponse>();
  let latest: WatchEvent | null = null;
  let shown = false;

  const send = (event: WatchEvent): void => {
    latest = event;
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const each of pagesOpen) each.write(data);
  };

  /** INT-852 and INT-853: checks the file, prints the result and sends it to every open page. */
  const checkFile = async (): Promise<void> => {
    let source: string;
    try {
      source = await readFile(path, 'utf8');
    } catch (error) {
      const problem = unreadable(name, error);
      out(`${problem}\n`);
      send({ file: name, problem });
      return;
    }
    const result = check(source);
    const lines = result.diagnostics.map((found) => options.line(options.file, found));
    if (result.model !== null) shown = true;
    const status =
      result.model !== null
        ? 'Updated.'
        : shown
          ? 'Showing the last version without errors.'
          : 'There is nothing to show until the errors are fixed.';
    out([...lines, status].join('\n') + '\n');
    send({ file: name, source });
  };

  let checking: Promise<void> = Promise.resolve();
  const recheck = (): void => {
    checking = checking.then(checkFile);
  };

  const server = createServer((request, response) => {
    const port = (server.address() as { port: number }).port;
    if (!hostAllowed(request, port)) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Aerie only answers pages on this computer.\n');
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end();
      return;
    }
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === EVENTS_PATH) {
      response.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
      });
      response.write('retry: 1000\n\n');
      if (latest !== null) response.write(`data: ${JSON.stringify(latest)}\n\n`);
      pagesOpen.add(response);
      request.on('close', () => pagesOpen.delete(response));
      return;
    }
    void servePage(url.pathname, response);
  });

  const servePage = async (pathname: string, response: ServerResponse): Promise<void> => {
    if (pathname === '/' || pathname === '/index.html') {
      response.writeHead(200, {
        'Content-Type': TYPES['.html'] ?? '',
        'Cache-Control': 'no-store',
      });
      response.end(page);
      return;
    }
    let file: string;
    try {
      file = resolve(pages, `.${decodeURIComponent(pathname)}`);
    } catch {
      file = '';
    }
    const inside = file.startsWith(pages + sep);
    const found = inside ? await stat(file).catch(() => null) : null;
    if (found?.isFile() !== true) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found.\n');
      return;
    }
    response.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    });
    response.end(await readFile(file));
  };

  await new Promise<void>((done, fail) => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      fail(
        error.code === 'EADDRINUSE'
          ? new CannotWatch(
              `Port ${String(options.port)} is already in use. Choose another with --port, as in aerie watch ${options.file} --port ${String(options.port + 1)}.`,
            )
          : new CannotWatch(`Aerie cannot start its server: ${error.message}`),
      );
    });
    server.listen(options.port, '127.0.0.1', () => {
      done();
    });
  });

  // INT-852: watch the folder, not the file, so saves that replace the file are seen too, and a
  // file that is deleted and comes back is found again (INT-854).
  let settle: ReturnType<typeof setTimeout> | null = null;
  const folder: FSWatcher = watchFolder(await realpath(dirname(path)), (_event, changed) => {
    if (changed !== null && changed !== name) return;
    if (settle !== null) clearTimeout(settle);
    settle = setTimeout(() => {
      settle = null;
      recheck();
    }, SETTLE);
  });

  const port = (server.address() as { port: number }).port;
  const url = `http://127.0.0.1:${String(port)}/`;
  out(`Aerie is watching ${options.file}. The diagram is at ${url}\nPress Ctrl+C to stop.\n`);
  recheck();
  await checking;
  options.open?.(url);

  return {
    url,
    close: async () => {
      folder.close();
      if (settle !== null) clearTimeout(settle);
      await checking;
      for (const each of pagesOpen) each.end();
      pagesOpen.clear();
      await new Promise<void>((done) => {
        server.close(() => {
          done();
        });
        server.closeAllConnections();
      });
    },
  };
}
