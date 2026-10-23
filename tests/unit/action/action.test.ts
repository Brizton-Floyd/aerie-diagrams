// The GitHub Action (docs/spec/drift.md, section 8; DRIFT-601 to DRIFT-605): its inputs, the
// sibling repos it checks out, the sticky comment, the suggestions on lines a pull request adds,
// and whole runs against a GitHub kept in memory. .github/workflows/drift.yml runs it for real.
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  addedLines,
  postSuggestions,
  suggestionComments,
  suggestionMarker,
  upsertComment,
  type ReviewComment,
} from '../../../src/action/comments.ts';
import { listAll, pullRequestOf, type Api, type PullRequest } from '../../../src/action/github.ts';
import { BadInput, readInputs, readRepos, type Inputs } from '../../../src/action/inputs.ts';
import { cannotRunComment, driftInProcess, runAction } from '../../../src/action/main.ts';
import { cloneSibling, siblingsOf } from '../../../src/action/siblings.ts';
import { commentMarker, type DriftDocument } from '../../../src/drift/index.ts';

const ROOT = join(import.meta.dirname, '../../..');
const MODEL = relative(ROOT, join(import.meta.dirname, 'fixtures', 'shop-drift.aerie'));
const CLEAN = relative(ROOT, join(ROOT, 'tests/unit/drift/fixtures/compose/shop.aerie'));
const PR: PullRequest = { owner: 'o', repo: 'r', number: 7, head: 'abc123' };

interface Stored {
  id: number;
  body: string;
}

/** A pull request on a GitHub in memory: its comments, review comments, reviews and files. */
function memoryGithub(files: { filename: string; patch?: string }[] = []): {
  api: Api;
  comments: Stored[];
  reviews: { commit_id: string; body: string; comments: ReviewComment[] }[];
  calls: string[];
} {
  const comments: Stored[] = [];
  const reviewComments: Stored[] = [];
  const reviews: { commit_id: string; body: string; comments: ReviewComment[] }[] = [];
  const calls: string[] = [];
  let next = 1;
  const page = <T>(items: T[], path: string): T[] => {
    const query = new URL(path, 'https://api.test').searchParams;
    const size = Number(query.get('per_page') ?? 30);
    const from = (Number(query.get('page') ?? 1) - 1) * size;
    return items.slice(from, from + size);
  };
  const api: Api = {
    request: (method, path, body) => {
      const bare = path.replace(/\?.*/, '');
      calls.push(`${method} ${bare}`);
      const given = body as { body: string; comments?: ReviewComment[]; commit_id?: string };
      if (method === 'GET' && bare === '/repos/o/r/issues/7/comments') {
        return Promise.resolve(page(comments, path));
      }
      if (method === 'POST' && bare === '/repos/o/r/issues/7/comments') {
        comments.push({ id: next++, body: given.body });
        return Promise.resolve({});
      }
      const edited = /^\/repos\/o\/r\/issues\/comments\/(\d+)$/.exec(bare);
      if (method === 'PATCH' && edited !== null) {
        const found = comments.find((each) => each.id === Number(edited[1]));
        if (found !== undefined) found.body = given.body;
        return Promise.resolve({});
      }
      if (method === 'GET' && bare === '/repos/o/r/pulls/7/files') {
        return Promise.resolve(page(files, path));
      }
      if (method === 'GET' && bare === '/repos/o/r/pulls/7/comments') {
        return Promise.resolve(page(reviewComments, path));
      }
      if (method === 'POST' && bare === '/repos/o/r/pulls/7/reviews') {
        reviews.push({
          commit_id: given.commit_id ?? '',
          body: given.body,
          comments: given.comments ?? [],
        });
        for (const each of given.comments ?? [])
          reviewComments.push({ id: next++, body: each.body });
        return Promise.resolve({});
      }
      return Promise.reject(new Error(`unexpected ${method} ${path}`));
    },
  };
  return { api, comments, reviews, calls };
}

/** A file's whole text as the patch of a pull request that adds it. */
function addingPatch(text: string): string {
  const lines = text.replace(/\n$/, '').split('\n');
  return [`@@ -0,0 +1,${String(lines.length)} @@`, ...lines.map((line) => `+${line}`)].join('\n');
}

async function documentOf(model: string): Promise<DriftDocument> {
  return JSON.parse(
    (await driftInProcess(['drift', model, '--format', 'json'])).out,
  ) as DriftDocument;
}

const inputs = (models: string[], more: Partial<Inputs> = {}): Inputs => ({
  models,
  failOn: 'drift',
  comment: 'always',
  token: 't',
  reposToken: 't',
  repos: new Map(),
  ...more,
});

describe('DRIFT-601 the inputs', () => {
  it('DRIFT-601 reads the model files, fail-on, comment and tokens, with their defaults', () => {
    expect(
      readInputs({ AERIE_MODELS: ' a.aerie\n  docs/b.aerie c.aerie ', AERIE_TOKEN: 't' }),
    ).toEqual({
      models: ['a.aerie', 'docs/b.aerie', 'c.aerie'],
      failOn: 'drift',
      comment: 'always',
      token: 't',
      reposToken: 't',
      repos: new Map(),
    });
    expect(
      readInputs({
        AERIE_MODELS: 'a.aerie',
        AERIE_FAIL_ON: 'likely',
        AERIE_COMMENT: 'on-findings',
        AERIE_TOKEN: 't',
        AERIE_REPOS_TOKEN: 'secret',
      }),
    ).toMatchObject({ failOn: 'likely', comment: 'on-findings', reposToken: 'secret' });
  });

  it('DRIFT-601 a wrong input stops the action with a plain message', () => {
    expect(() => readInputs({})).toThrow(
      new BadInput('Name the model files to check in models, as in models: architecture.aerie.'),
    );
    expect(() => readInputs({ AERIE_MODELS: 'a.aerie', AERIE_FAIL_ON: 'warning' })).toThrow(
      'fail-on is drift or likely, not warning.',
    );
    expect(() => readInputs({ AERIE_MODELS: 'a.aerie', AERIE_COMMENT: 'sometimes' })).toThrow(
      'comment is always, on-findings or never, not sometimes.',
    );
  });

  it('DRIFT-601 the pull request comes from the event, and other events have none', () => {
    const event = { pull_request: { number: 7, head: { sha: 'abc123' } } };
    expect(pullRequestOf('o/r', event)).toEqual(PR);
    expect(pullRequestOf('o/r', { push: {} })).toBeNull();
    expect(pullRequestOf('o/r', null)).toBeNull();
  });
});

describe('DRIFT-602 sibling repos', () => {
  const folders: string[] = [];
  afterEach(() => {
    for (const each of folders.splice(0)) rmSync(each, { recursive: true, force: true });
  });
  const temporary = (): string => {
    const folder = mkdtempSync(join(tmpdir(), 'aerie-action-'));
    folders.push(folder);
    return folder;
  };

  it('DRIFT-602 repos lines name a repository and, if needed, a branch', () => {
    expect(
      readRepos('# the Lotto repos\n../core=acme/lotto-core@main\n\nlotto-ui = acme/ui\n'),
    ).toEqual(
      new Map([
        ['../core', { repository: 'acme/lotto-core', ref: 'main' }],
        ['lotto-ui', { repository: 'acme/ui', ref: null }],
      ]),
    );
    for (const wrong of ['acme/ui', '=acme/ui', '../ui=ui', '../ui=acme/ui@']) {
      expect(() => readRepos(wrong)).toThrow(
        `Each line of repos is <repo line>=<owner>/<name>, with @<branch> if needed, not ${wrong}.`,
      );
    }
  });

  it('DRIFT-602 checks out each repo line outside the model repository that is not there', () => {
    const top = temporary();
    const home = join(top, 'home');
    mkdirSync(join(home, '.git'), { recursive: true });
    mkdirSync(join(top, 'present'));
    mkdirSync(join(home, 'inside'));
    const model = join(home, 'model.aerie');
    const system = {
      repos: ['.', 'inside', '../present', '../core', '../lotto-ui', '../other'],
      compose: [],
    };
    const repos = readRepos('../core=acme/lotto-core@main\nlotto-ui=acme/ui');
    expect(siblingsOf(model, system, repos, 'owner')).toEqual([
      {
        written: '../core',
        path: join(top, 'core'),
        source: { repository: 'acme/lotto-core', ref: 'main' },
      },
      {
        written: '../lotto-ui',
        path: join(top, 'lotto-ui'),
        source: { repository: 'acme/ui', ref: null },
      },
      {
        written: '../other',
        path: join(top, 'other'),
        source: { repository: 'owner/other', ref: null },
      },
    ]);
    expect(siblingsOf(model, null, repos, 'owner')).toEqual([]);
  });

  it('DRIFT-602 a sibling is cloned shallow, read again on the next run, and drift reads it', async () => {
    // A remote on the disk stands for the GitHub server: owner/stack.git holds the Compose stack.
    const server = temporary();
    const remote = join(server, 'owner', 'stack');
    cpSync(join(ROOT, 'tests/unit/drift/fixtures/compose/stack'), remote, { recursive: true });
    const git = (cwd: string, ...args: string[]): string =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
        cwd,
        encoding: 'utf8',
      });
    git(remote, 'init', '--quiet', '--initial-branch', 'main');
    git(remote, 'add', '.');
    git(remote, 'commit', '--quiet', '-m', 'stack');
    execFileSync('git', ['clone', '--quiet', '--bare', remote, `${remote}.git`]);

    const top = temporary();
    const home = join(top, 'home');
    mkdirSync(join(home, '.git'), { recursive: true });
    const model = join(home, 'shop.aerie');
    const source = readFileSync(join(ROOT, 'tests/unit/drift/fixtures/compose/shop.aerie'), 'utf8');
    writeFileSync(model, source.replace(/system\n(?: .*\n)+/, 'system\n  repo ../stack\n'));
    const parsed = { repos: ['../stack'], compose: [] };
    const [sibling] = siblingsOf(model, parsed, new Map(), 'owner');
    expect(sibling?.path).toBe(join(top, 'stack'));
    if (sibling === undefined) return;
    cloneSibling(sibling, `file://${server}`, '');
    expect(git(sibling.path, 'rev-list', '--count', 'HEAD').trim()).toBe('1');
    const ran = await driftInProcess(['drift', model]);
    expect(ran.err).toBe('');
    expect(ran.code).toBe(0);

    // A later run on the same machine checks it out again rather than reading what is left.
    writeFileSync(join(sibling.path, 'stale'), '');
    expect(siblingsOf(model, parsed, new Map(), 'owner')).toEqual([sibling]);
    cloneSibling(sibling, `file://${server}`, '');
    expect(existsSync(join(sibling.path, 'stale'))).toBe(false);

    expect(() => {
      cloneSibling(
        { ...sibling, source: { repository: 'owner/gone', ref: null } },
        `file://${server}`,
        '',
      );
    }).toThrow(/^Aerie could not check out owner\/gone for the line repo \.\.\/stack: /);
  });
});

describe('DRIFT-603 the sticky comment', () => {
  const marker = commentMarker('a.aerie');

  it('DRIFT-603 is posted once, then edited in place, and left alone when it reads the same', async () => {
    const github = memoryGithub();
    github.comments.push({ id: 90, body: 'Looks good to me' });
    expect(await upsertComment(github.api, PR, marker, `${marker}\nred`, 'always', true)).toBe(
      'created',
    );
    expect(await upsertComment(github.api, PR, marker, `${marker}\ngreen`, 'always', false)).toBe(
      'updated',
    );
    expect(await upsertComment(github.api, PR, marker, `${marker}\ngreen`, 'always', false)).toBe(
      'unchanged',
    );
    expect(github.comments).toEqual([
      { id: 90, body: 'Looks good to me' },
      { id: 1, body: `${marker}\ngreen` },
    ]);
  });

  it('DRIFT-603 each model file has its own, found again past the first page', async () => {
    const github = memoryGithub();
    for (let id = 100; id < 250; id++) github.comments.push({ id, body: `comment ${String(id)}` });
    const other = commentMarker('a.aerie.old');
    github.comments.push({ id: 300, body: `${other}\nother` });
    expect(await upsertComment(github.api, PR, marker, `${marker}\nred`, 'always', true)).toBe(
      'created',
    );
    expect(await upsertComment(github.api, PR, marker, `${marker}\namber`, 'always', true)).toBe(
      'updated',
    );
    expect(github.comments.slice(-2)).toEqual([
      { id: 300, body: `${other}\nother` },
      { id: 1, body: `${marker}\namber` },
    ]);
    expect(await listAll(github.api, '/repos/o/r/issues/7/comments')).toHaveLength(152);
  });

  it('DRIFT-603 on-findings creates it only when something is found; never posts nothing', async () => {
    const github = memoryGithub();
    expect(
      await upsertComment(github.api, PR, marker, `${marker}\ngreen`, 'on-findings', false),
    ).toBe('skipped');
    expect(github.comments).toEqual([]);
    expect(await upsertComment(github.api, PR, marker, `${marker}\nred`, 'on-findings', true)).toBe(
      'created',
    );
    expect(
      await upsertComment(github.api, PR, marker, `${marker}\ngreen`, 'on-findings', false),
    ).toBe('updated');
    expect(await upsertComment(github.api, PR, marker, `${marker}\nred`, 'never', true)).toBe(
      'skipped',
    );
    expect(github.comments).toEqual([{ id: 1, body: `${marker}\ngreen` }]);
  });
});

describe('DRIFT-604 suggestions on the lines a pull request adds', () => {
  it('DRIFT-604 the added lines of a patch, by their number in the new file', () => {
    const patch = [
      '@@ -1,3 +1,4 @@',
      ' a',
      '-b',
      '+B',
      '+C\r',
      ' d',
      '@@ -10,2 +11,2 @@',
      '-x',
      '+X',
      ' y',
    ];
    expect(addedLines(patch.join('\n'))).toEqual(
      new Map([
        [2, 'B'],
        [3, 'C'],
        [11, 'X'],
      ]),
    );
  });

  it('DRIFT-604 every edit of a model the pull request adds becomes a suggestion', async () => {
    const document = await documentOf(MODEL);
    const added = addedLines(addingPatch(readFileSync(join(ROOT, MODEL), 'utf8')));
    const comments = suggestionComments(document, MODEL, added);
    const key = (at: number, id: string): string =>
      suggestionMarker(MODEL, document.findings.find((each) => each.id === id)?.key ?? '', at);
    expect(comments).toEqual([
      {
        path: MODEL,
        line: 18,
        side: 'RIGHT',
        body: [
          key(18, 'D01'),
          '**D01** The code line of Payments names `compose:payment`, which the code no longer has; it has `compose:payments` instead, which no element names.',
          '',
          '```suggestion',
          '    code compose:payments',
          '```',
        ].join('\n'),
      },
      {
        path: MODEL,
        start_line: 23,
        start_side: 'RIGHT',
        line: 24,
        side: 'RIGHT',
        body: [
          key(23, 'D02'),
          '**D02** The code line of Search names `compose:search`, which the code does not have.',
          '',
          '```suggestion',
          '```',
        ].join('\n'),
      },
      expect.objectContaining({
        line: 24,
        body: expect.stringContaining(
          '```suggestion\n    code compose:search\n  cache: cache [service]\n    code compose:cache\n```',
        ) as string,
      }),
      expect.objectContaining({
        line: 32,
        body: expect.stringContaining(
          '\npayments charges cards at bank\napi calls cache\n```',
        ) as string,
      }),
      expect.objectContaining({
        line: 32,
        body: expect.stringContaining(
          '\npayments charges cards at bank\nworker calls api\n```',
        ) as string,
      }),
      expect.objectContaining({ line: 30, body: expect.stringContaining('**L01**') as string }),
      expect.objectContaining({ line: 35, body: expect.stringContaining('**L02**') as string }),
      expect.objectContaining({
        line: 32,
        body: expect.stringContaining(
          '\npayments charges cards at bank\napi calls db\n```',
        ) as string,
      }),
    ]);
  });

  it('DRIFT-604 edits on lines it does not add, or that read otherwise at its head, are left out', async () => {
    const document = await documentOf(MODEL);
    // Only the Payments code line is added, and the search line reads otherwise at the head.
    const added = new Map([
      [18, '    code compose:payment'],
      [23, '  search: Search [service] '],
      [24, '    code compose:search'],
    ]);
    const comments = suggestionComments(document, MODEL, added);
    expect(comments.map((each) => each.body.split('\n')[1]?.slice(0, 7))).toEqual([
      '**D01**',
      '**D03**',
    ]);
    expect(suggestionComments(document, MODEL, new Map())).toEqual([]);
  });

  it('DRIFT-604 they are posted as one review on the head commit, each only once', async () => {
    const github = memoryGithub();
    const document = await documentOf(MODEL);
    const comments = suggestionComments(
      document,
      MODEL,
      addedLines(addingPatch(readFileSync(join(ROOT, MODEL), 'utf8'))),
    );
    expect(await postSuggestions(github.api, PR, MODEL, comments)).toBe(8);
    expect(await postSuggestions(github.api, PR, MODEL, comments)).toBe(0);
    expect(github.reviews).toEqual([
      {
        commit_id: 'abc123',
        body: `Aerie drift suggests 8 edits to \`${MODEL}\` on lines this pull request adds.`,
        comments,
      },
    ]);
  });
});

describe('DRIFT-605 a run of the action', () => {
  it('DRIFT-605 fails on drift, comments once per model file, and suggests on added lines', async () => {
    const github = memoryGithub([
      { filename: MODEL, patch: addingPatch(readFileSync(join(ROOT, MODEL), 'utf8')) },
    ]);
    const log: string[] = [];
    const summary: string[] = [];
    const deps = {
      api: github.api,
      log: (line: string) => log.push(line),
      summary: (markdown: string) => summary.push(markdown),
      clone: () => {
        throw new Error('nothing to check out');
      },
      drift: driftInProcess,
    };
    const context = { repository: 'o/r', pr: PR };
    expect(await runAction(inputs([CLEAN, MODEL]), context, deps)).toBe(1);
    expect(await runAction(inputs([CLEAN, MODEL]), context, deps)).toBe(1);
    expect(github.comments.map((each) => each.body.split('\n').slice(0, 2))).toEqual([
      [commentMarker(CLEAN), `### 🟢 Aerie drift: \`${CLEAN}\``],
      [commentMarker(MODEL), `### 🔴 Aerie drift: \`${MODEL}\``],
    ]);
    expect(github.reviews).toHaveLength(1);
    expect(summary).toHaveLength(4);
    expect(log).toContain(`${MODEL}: 4 drift, 3 likely, exit code 1`);
    expect(log).toContain(`The pull request comment for ${MODEL}: unchanged`);
    expect(await runAction(inputs([CLEAN]), context, deps)).toBe(0);
  });

  it('DRIFT-605 a model file drift cannot check gives exit code 2 and says why in its comment', async () => {
    const github = memoryGithub();
    const log: string[] = [];
    const deps = {
      api: github.api,
      log: (line: string) => log.push(line),
      summary: () => undefined,
      clone: () => undefined,
      drift: driftInProcess,
    };
    expect(
      await runAction(inputs(['nowhere.aerie', CLEAN]), { repository: 'o/r', pr: PR }, deps),
    ).toBe(2);
    expect(github.comments[0]?.body).toBe(
      cannotRunComment('nowhere.aerie', 'There is no file called nowhere.aerie.\n'),
    );
    expect(github.comments[0]?.body).toBe(
      [
        commentMarker('nowhere.aerie'),
        '### ⚪ Aerie drift: `nowhere.aerie`',
        '',
        'Drift cannot run:',
        '',
        '```',
        'There is no file called nowhere.aerie.',
        '```',
        '',
      ].join('\n'),
    );
    expect(log).toContain('::error title=Aerie drift::There is no file called nowhere.aerie.');
  });

  it('DRIFT-605 outside a pull request it only reports, and a comment it cannot post is a warning', async () => {
    const log: string[] = [];
    const failing: Api = {
      request: () => Promise.reject(new Error('403 Resource not accessible by integration')),
    };
    const deps = {
      api: failing,
      log: (line: string) => log.push(line),
      summary: () => undefined,
      clone: () => undefined,
      drift: driftInProcess,
    };
    expect(await runAction(inputs([MODEL]), { repository: 'o/r', pr: null }, deps)).toBe(1);
    expect(log.some((line) => line.startsWith('::warning'))).toBe(false);
    expect(
      await runAction(inputs([MODEL], { failOn: 'likely' }), { repository: 'o/r', pr: PR }, deps),
    ).toBe(1);
    expect(log).toContain(
      `::warning title=Aerie drift::Aerie could not post the pull request comment for ${MODEL}: 403 Resource not accessible by integration`,
    );
  });
});
