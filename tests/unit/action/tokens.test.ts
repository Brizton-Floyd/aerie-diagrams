// The Action's tokens (docs/spec/drift.md, section 8; DRIFT-606): git gets the clone token's header
// only through its environment, every form of a token is masked first, and nothing the Action
// prints, writes to the summary or throws holds one. The last test runs the Action as GitHub does,
// against a local HTTP server standing for the GitHub server, which records the header git sent.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { maskCommands, redact, secretForms, tokenHeader } from '../../../src/action/secrets.ts';
import { cloneSibling, headerEnv, type Git, type Sibling } from '../../../src/action/siblings.ts';

const ROOT = join(import.meta.dirname, '../../..');
const TOKEN = 'ghs_secretTokenValue0123456789';
const BASE64 = Buffer.from(`x-access-token:${TOKEN}`).toString('base64');

/** Whether text holds the token in any form. */
const leaks = (text: string): boolean => text.includes(TOKEN) || text.includes(BASE64);

const folders: string[] = [];
afterEach(() => {
  for (const each of folders.splice(0)) rmSync(each, { recursive: true, force: true });
});
const temporary = (): string => {
  const folder = mkdtempSync(join(tmpdir(), 'aerie-tokens-'));
  folders.push(folder);
  return folder;
};

const sibling = (path: string): Sibling => ({
  written: '../core',
  path,
  source: { repository: 'acme/core', ref: 'main' },
});

describe('DRIFT-606 tokens', () => {
  it('DRIFT-606 git gets the header in its environment, never as an argument', () => {
    const calls: { args: string[]; env: Record<string, string> }[] = [];
    const git: Git = (args, env) => {
      calls.push({ args, env });
      mkdirSync(join(args.at(-1) ?? '', '.git'), { recursive: true });
    };
    cloneSibling(sibling(join(temporary(), 'core')), 'https://github.com', TOKEN, git);
    expect(calls).toHaveLength(1);
    expect(leaks(calls[0]?.args.join(' ') ?? '')).toBe(false);
    expect(calls[0]?.env).toEqual({
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
      GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${BASE64}`,
    });
    // After any configuration the environment already gives git; and none without a token.
    expect(headerEnv('https://github.com', TOKEN, { GIT_CONFIG_COUNT: '2' })).toEqual({
      GIT_CONFIG_COUNT: '3',
      GIT_CONFIG_KEY_2: 'http.https://github.com/.extraheader',
      GIT_CONFIG_VALUE_2: tokenHeader(TOKEN),
    });
    expect(headerEnv('https://github.com', '')).toEqual({});
    expect(headerEnv('file:///srv/git', TOKEN)).toEqual({});
  });

  it('DRIFT-606 a failed clone never throws the token, whatever git says', () => {
    const path = join(temporary(), 'core');
    const failing =
      (stderr: string | undefined): Git =>
      (args, env) => {
        const error = new Error(
          `Command failed: git ${args.join(' ')} ${JSON.stringify(env)} ${TOKEN}`,
        );
        throw Object.assign(error, { stderr });
      };
    for (const stderr of [undefined, '', `fatal: bad header ${BASE64} for ${TOKEN}`]) {
      let thrown = '';
      try {
        cloneSibling(sibling(path), 'https://github.com', TOKEN, failing(stderr));
      } catch (error) {
        thrown = (error as Error).message;
        expect((error as Error).cause).toBeUndefined();
      }
      expect(thrown).toMatch(
        /^Aerie could not check out acme\/core@main for the line repo \.\.\/core: /,
      );
      expect(thrown).toContain('***');
      expect(leaks(thrown)).toBe(false);
    }
  });

  it('DRIFT-606 every form of each token is masked once, and redacted', () => {
    expect(maskCommands(TOKEN, TOKEN, '')).toEqual([
      `::add-mask::${TOKEN}`,
      `::add-mask::${BASE64}`,
    ]);
    expect(secretForms('')).toEqual([]);
    expect(redact(`a ${TOKEN} b ${BASE64} c`, secretForms(TOKEN))).toBe('a *** b *** c');
  });

  it('DRIFT-606 a run of the action masks the tokens first and never prints or writes one', async () => {
    // The GitHub server: answers every request with 404 and prints its path and Authorization.
    const server = spawn(
      process.execPath,
      [
        '-e',
        `const s = require('node:http').createServer((q, r) => {
          console.log(JSON.stringify({ url: q.url, auth: q.headers.authorization ?? null }));
          r.statusCode = 404; r.end();
        });
        s.listen(0, '127.0.0.1', () => console.log('port ' + s.address().port));`,
      ],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    try {
      let heard = '';
      server.stdout.on('data', (chunk: Buffer) => {
        heard += chunk.toString();
      });
      const port = await new Promise<string>((found) => {
        server.stdout.on('data', () => {
          const match = /port (\d+)/.exec(heard);
          if (match?.[1] !== undefined) found(match[1]);
        });
      });

      // A model whose system root names a sibling repo the action must check out.
      const top = temporary();
      const home = join(top, 'home');
      mkdirSync(join(home, '.git'), { recursive: true });
      const model = join(home, 'shop.aerie');
      const shop = readFileSync(join(ROOT, 'tests/unit/drift/fixtures/compose/shop.aerie'), 'utf8');
      writeFileSync(model, shop.replace(/system\n(?: .*\n)+/, 'system\n  repo ../core\n'));
      const summary = join(top, 'summary.md');
      const ran = spawnSync(process.execPath, [join(ROOT, 'src/action/main.ts')], {
        cwd: ROOT,
        encoding: 'utf8',
        env: {
          PATH: process.env['PATH'] ?? '',
          HOME: process.env['HOME'] ?? '',
          GIT_TERMINAL_PROMPT: '0',
          AERIE_MODELS: model,
          AERIE_TOKEN: TOKEN,
          GITHUB_REPOSITORY: 'acme/diagram',
          GITHUB_SERVER_URL: `http://127.0.0.1:${port}`,
          GITHUB_STEP_SUMMARY: summary,
        },
      });
      await new Promise((settle) => setTimeout(settle, 100));

      expect(ran.status).toBe(2);
      const lines = ran.stdout.trimEnd().split('\n');
      expect(lines.slice(0, 2)).toEqual([`::add-mask::${TOKEN}`, `::add-mask::${BASE64}`]);
      expect(lines.slice(2).filter(leaks)).toEqual([]);
      expect(lines).toContain('Checking out acme/core as repo ../core');
      expect(
        lines.some((line) =>
          line.startsWith(
            '::error title=Aerie drift::Aerie could not check out acme/core for the line repo ../core: ',
          ),
        ),
      ).toBe(true);
      expect(leaks(ran.stderr)).toBe(false);
      expect(leaks(readFileSync(summary, 'utf8'))).toBe(false);
      // git sent the header it was given, through its environment.
      expect(heard).toContain(`"auth":"basic ${BASE64}"`);
      expect(heard).toContain('/acme/core.git/info/refs');
    } finally {
      server.kill();
    }
  });
});
