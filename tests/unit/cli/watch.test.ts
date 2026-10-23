// `aerie watch` (docs/spec/interaction.md, INT-851 to INT-855): the server, run against a real
// folder, a real file and real connections on this machine.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { diagnosticLine, run, type Io } from '../../../src/cli/aerie.ts';
import {
  CannotWatch,
  EVENTS_PATH,
  SETTLE,
  WATCH_PORT,
  unreadable,
  watch,
  type Watching,
} from '../../../src/cli/watch.ts';
import type { WatchEvent } from '../../../src/app/watching.ts';

/** The spec's worked example keeps one W601, so it shows how a warning is printed. */
const WARNED = readFileSync(
  join(import.meta.dirname, '../../../docs/spec/examples/lotto.aerie'),
  'utf8',
);
const GOOD = 'web: Web\napi: API\nweb calls api\n';
const RENAMED = 'web: Web shop\napi: API\nweb calls api\n';
const BROKEN = 'web: Web\napi: API\nweb calls apu\n';
const PAGE = '<!doctype html>\n<html>\n  <head>\n    <title>Aerie</title>\n  </head>\n</html>\n';

let folder = '';
let file = '';
let pages = '';
let printed = '';
let open: Watching | null = null;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'aerie-watch-'));
  file = join(folder, 'model.aerie');
  pages = join(folder, 'dist');
  mkdirSync(join(pages, 'assets'), { recursive: true });
  writeFileSync(join(pages, 'index.html'), PAGE);
  writeFileSync(join(pages, 'assets', 'page.js'), 'export {};\n');
  writeFileSync(join(folder, 'secret.txt'), 'not for the page\n');
  writeFileSync(file, GOOD);
  printed = '';
});

afterEach(async () => {
  await open?.close();
  open = null;
  rmSync(folder, { recursive: true, force: true });
});

async function start(port = 0): Promise<Watching> {
  open = await watch({
    file,
    port,
    pages,
    out: (text) => {
      printed += text;
    },
    line: diagnosticLine,
  });
  return open;
}

/** Waits until `ready` holds, checking every 20 ms, for at most five seconds. */
async function until(ready: () => boolean, what: string): Promise<void> {
  for (let waited = 0; waited < 5000; waited += 20) {
    if (ready()) return;
    await new Promise((done) => setTimeout(done, 20));
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** A page's connection to the server: every event it has received so far. */
async function connect(url: string): Promise<{ events: WatchEvent[]; stop: () => void }> {
  const control = new AbortController();
  const response = await fetch(new URL(EVENTS_PATH, url), { signal: control.signal });
  expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
  const events: WatchEvent[] = [];
  const reader = response.body?.pipeThrough(new TextDecoderStream()).getReader();
  void (async () => {
    let buffer = '';
    for (;;) {
      const chunk = await reader?.read().catch(() => null);
      if (chunk === null || chunk === undefined || chunk.done) return;
      buffer += chunk.value;
      let end;
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = /^data: (.*)$/m.exec(block)?.[1];
        if (data !== undefined) events.push(JSON.parse(data) as WatchEvent);
      }
    }
  })();
  return {
    events,
    stop: () => {
      control.abort();
    },
  };
}

/** A GET with a chosen Host header, which fetch does not allow. */
function get(url: string, host?: string): Promise<{ status: number; body: string }> {
  return new Promise((done, fail) => {
    const target = new URL(url);
    const headers = host === undefined ? {} : { host };
    request(target, { headers }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => (body += chunk));
      response.on('end', () => {
        done({ status: response.statusCode ?? 0, body });
      });
    })
      .on('error', fail)
      .end();
  });
}

describe('the server', () => {
  it('INT-851 listens on 127.0.0.1 only, on port 4310 unless told otherwise, and prints its address', async () => {
    expect(WATCH_PORT).toBe(4310);
    const watching = await start();
    expect(watching.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    expect(printed).toContain(`Aerie is watching ${file}. The diagram is at ${watching.url}\n`);
    expect(printed).toContain('Press Ctrl+C to stop.\n');
    const port = new URL(watching.url).port;
    await expect(fetch(`http://[::1]:${port}/`)).rejects.toThrow();
  });

  it("INT-851 serves Aerie's built page, marked so it follows the file, and the page's files", async () => {
    const watching = await start();
    const page = await get(watching.url);
    expect(page.status).toBe(200);
    expect(page.body).toContain(`<meta name="aerie-watch" content="${EVENTS_PATH}" />`);
    expect((await get(new URL('assets/page.js', watching.url).href)).body).toBe('export {};\n');
    expect((await get(new URL('missing.js', watching.url).href)).status).toBe(404);
  });

  it('INT-851 serves nothing outside the page folder, and nothing to pages asked for by another name', async () => {
    const watching = await start();
    const port = new URL(watching.url).port;
    expect((await get(`${watching.url}..%2Fsecret.txt`)).status).toBe(404);
    expect((await get(`${watching.url}%2E%2E/secret.txt`)).status).toBe(404);
    expect((await get(watching.url, `localhost:${port}`)).status).toBe(200);
    const elsewhere = await get(watching.url, `aerie.example:${port}`);
    expect(elsewhere.status).toBe(403);
    expect(elsewhere.body).toBe('Aerie only answers pages on this computer.\n');
    expect((await get(`${watching.url}${EVENTS_PATH.slice(1)}`, 'aerie.example')).status).toBe(403);
  });

  it('INT-851 says so in plain words when the page is not built, the file is missing or the port is taken', async () => {
    rmSync(join(pages, 'index.html'));
    await expect(start()).rejects.toThrow(
      new CannotWatch(
        "Aerie's page is not built yet. Run npm run build in the Aerie checkout, then try again.",
      ),
    );
    writeFileSync(join(pages, 'index.html'), PAGE);
    unlinkSync(file);
    await expect(start()).rejects.toThrow(new CannotWatch(`There is no file called ${file}.`));
    writeFileSync(file, GOOD);
    const taken = createServer();
    await new Promise<void>((done) => taken.listen(0, '127.0.0.1', done));
    const port = (taken.address() as { port: number }).port;
    await expect(start(port)).rejects.toThrow(
      `Port ${String(port)} is already in use. Choose another with --port, as in aerie watch ${file} --port ${String(port + 1)}.`,
    );
    taken.close();
  });
});

describe('following the file', () => {
  it('INT-852 an open page gets the file at once, and again each time it is saved', async () => {
    const watching = await start();
    const page = await connect(watching.url);
    await until(() => page.events.length === 1, 'the first version');
    expect(page.events[0]).toEqual({ file: 'model.aerie', source: GOOD });
    writeFileSync(file, RENAMED);
    await until(() => page.events.length === 2, 'the saved version');
    expect(page.events[1]).toEqual({ file: 'model.aerie', source: RENAMED });
    page.stop();
  });

  it('INT-852 every open page gets each version', async () => {
    const watching = await start();
    const pages = [await connect(watching.url), await connect(watching.url)];
    writeFileSync(file, RENAMED);
    await until(() => pages.every((each) => each.events.length === 2), 'both pages');
    for (const each of pages) {
      expect(each.events.at(-1)).toEqual({ file: 'model.aerie', source: RENAMED });
      each.stop();
    }
  });

  it('INT-852 saves within 100 ms count as one', async () => {
    expect(SETTLE).toBe(100);
    await start();
    expect(printed.match(/Updated\./g)).toHaveLength(1);
    writeFileSync(file, BROKEN);
    writeFileSync(file, RENAMED);
    await until(() => printed.match(/Updated\./g)?.length === 2, 'the check');
    await new Promise((done) => setTimeout(done, 300));
    expect(printed.match(/Updated\./g)).toHaveLength(2);
    expect(printed).not.toContain('E008');
  });

  it('INT-853 the terminal prints the diagnostics of every check as aerie check does, then what the page shows', async () => {
    writeFileSync(file, BROKEN);
    await start();
    const typo = `${file}:3:11: error E008: There is no element called \`apu\`. Did you mean \`api\`?`;
    expect(printed).toContain(`${typo}\nThere is nothing to show until the errors are fixed.\n`);
    writeFileSync(file, GOOD);
    await until(() => printed.endsWith('Updated.\n'), 'the fixed version');
    printed = '';
    writeFileSync(file, BROKEN);
    await until(() => printed !== '', 'the broken version');
    expect(printed).toBe(`${typo}\nShowing the last version without errors.\n`);
    printed = '';
    writeFileSync(file, WARNED);
    await until(() => printed !== '', 'the Lotto example');
    expect(printed).toBe(
      `${file}:281:3: warning W601: No relationship joins \`updater\` and \`saved-draws\` in the model. Add one, such as \`updater saves draws into saved-draws\`, or check this step.\nUpdated.\n`,
    );
  });

  it('INT-854 a file that cannot be read keeps the page as it is, says why, and recovers when it comes back', async () => {
    const watching = await start();
    const page = await connect(watching.url);
    await until(() => page.events.length === 1, 'the first version');
    unlinkSync(file);
    await until(() => page.events.length === 2, 'the problem');
    const problem = 'Aerie cannot read model.aerie: there is no file with that name any more.';
    expect(page.events[1]).toEqual({ file: 'model.aerie', problem });
    expect(printed).toContain(`${problem}\n`);
    writeFileSync(file, RENAMED);
    await until(() => page.events.length === 3, 'the file again');
    expect(page.events[2]).toEqual({ file: 'model.aerie', source: RENAMED });
    page.stop();
  });

  it('INT-854 says why in plain words for other reasons too', () => {
    const code = (name: string): Error => Object.assign(new Error(name), { code: name });
    expect(unreadable('a.aerie', code('EISDIR'))).toBe(
      'Aerie cannot read a.aerie: it is a folder, not a file.',
    );
    expect(unreadable('a.aerie', code('EACCES'))).toBe(
      'Aerie cannot read a.aerie: it is not allowed to read it.',
    );
    expect(unreadable('a.aerie', code('EIO'))).toBe(
      'Aerie cannot read a.aerie: the file cannot be opened.',
    );
  });

  it('INT-855 stopping closes the server and every open page', async () => {
    const watching = await start();
    const page = await connect(watching.url);
    await until(() => page.events.length === 1, 'the first version');
    await watching.close();
    open = null;
    await expect(fetch(watching.url)).rejects.toThrow();
  });
});

describe('aerie watch on the command line', () => {
  function io(): Io & { out: string; err: string; started: string[] } {
    const fake = {
      out: '',
      err: '',
      started: [] as string[],
      read: (): Error => new Error('unused'),
      write: (): void => undefined,
      stdout: (text: string): void => {
        fake.out += text;
      },
      stderr: (text: string): void => {
        fake.err += text;
      },
      watch: async (begin: (pages: string) => Promise<Watching>): Promise<void> => {
        const watching = await begin(pages);
        fake.started.push(watching.url);
        await watching.close();
      },
    };
    return fake;
  }

  it('INT-851 aerie watch <file> --port <n> --no-open watches the file on that port', async () => {
    const fake = io();
    const port = await new Promise<number>((done) => {
      const probe = createServer();
      probe.listen(0, '127.0.0.1', () => {
        const found = (probe.address() as { port: number }).port;
        probe.close(() => {
          done(found);
        });
      });
    });
    expect(await run(['watch', file, '--port', String(port), '--no-open'], fake)).toBe(0);
    expect(fake.started).toEqual([`http://127.0.0.1:${String(port)}/`]);
    expect(fake.out).toContain('Updated.\n');
    expect(fake.err).toBe('');
  });

  it('INT-851 a command that cannot run exits with 2 and says why', async () => {
    const cases: [string[], string][] = [
      [['watch'], 'Name a file, as in aerie watch architecture.aerie.\n'],
      [['watch', 'a.aerie', 'b.aerie'], 'aerie watch shows one file. Name just one.\n'],
      [['watch', file, '--port', 'eighty'], '--port is a number from 0 to 65535, not eighty.\n'],
      [['watch', file, '--port', '70000'], '--port is a number from 0 to 65535, not 70000.\n'],
      [['watch', file, '--open'], 'There is no option called --open for aerie watch.\n'],
      [
        ['watch', join(folder, 'gone.aerie')],
        `There is no file called ${join(folder, 'gone.aerie')}.\n`,
      ],
    ];
    for (const [args, message] of cases) {
      const fake = io();
      expect(await run(args, fake), args.join(' ')).toBe(2);
      expect(fake.err).toBe(message);
    }
  });

  it('INT-851 the usage lists aerie watch', () => {
    const fake = io();
    expect(run(['help'], fake)).toBe(0);
    expect(fake.out).toContain(
      "aerie watch <file> [--port <n>] [--no-open]  show the file's diagram, updated on every save",
    );
  });
});
