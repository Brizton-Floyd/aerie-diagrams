// The few GitHub REST calls the Action makes (DRIFT-603, DRIFT-604): an `Api` the tests replace
// with one in memory, and the pull request the run is for, from the event GitHub wrote.

/** One REST call: the parsed JSON answer, or an `ApiError`. */
export interface Api {
  request: (method: string, path: string, body?: unknown) => Promise<unknown>;
}

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** The REST API at `base` (`GITHUB_API_URL`) with a token. */
export function restApi(base: string, token: string): Api {
  return {
    async request(method, path, body) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${token}`,
          'x-github-api-version': '2022-11-28',
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new ApiError(
          response.status,
          `${method} ${path}: ${String(response.status)} ${text}`,
        );
      }
      return text === '' ? null : (JSON.parse(text) as unknown);
    },
  };
}

const PAGE = 100;

/** Every item of a listing, page by page. */
export async function listAll<T>(api: Api, path: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const join = path.includes('?') ? '&' : '?';
    const got = (await api.request(
      'GET',
      `${path}${join}per_page=${String(PAGE)}&page=${String(page)}`,
    )) as T[];
    items.push(...got);
    if (got.length < PAGE) return items;
  }
}

/** The pull request a run is for: its repository, number and head commit. */
export interface PullRequest {
  owner: string;
  repo: string;
  number: number;
  head: string;
}

/** The pull request of a `pull_request` or `pull_request_target` event, else null. */
export function pullRequestOf(repository: string, event: unknown): PullRequest | null {
  const pr = (event as { pull_request?: { number?: unknown; head?: { sha?: unknown } } } | null)
    ?.pull_request;
  const [owner = '', repo = ''] = repository.split('/');
  if (typeof pr?.number !== 'number' || typeof pr.head?.sha !== 'string') return null;
  return { owner, repo, number: pr.number, head: pr.head.sha };
}
