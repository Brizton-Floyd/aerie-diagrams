// The GitHub Action (docs/spec/drift.md, section 8; `action.yml` runs this file): `aerie drift` on
// each model file, with its sibling repos checked out, the report in the job's summary, one sticky
// comment per model file and suggestions on the lines a pull request adds. The exit code is the
// worst of the model files' (DRIFT-605): 0 none, 1 drift (or likely, with `fail-on: likely`), 2 when
// drift cannot run.
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { nodeIo, run } from '../cli/aerie.ts';
import { repositoryOf, slashes } from '../cli/project.ts';
import { commentMarker, fence, type DriftDocument } from '../drift/index.ts';
import { parse, type System } from '../lines/index.ts';
import { addedLines, postSuggestions, suggestionComments, upsertComment } from './comments.ts';
import { listAll, pullRequestOf, restApi, type Api, type PullRequest } from './github.ts';
import { BadInput, readInputs, type Inputs } from './inputs.ts';
import { maskCommands, redact, secretForms } from './secrets.ts';
import { cloneSibling, siblingsOf, type Sibling } from './siblings.ts';

export interface Context {
  /** `owner/name` of the repository the workflow runs in. */
  repository: string;
  /** The pull request, or null for any other event. */
  pr: PullRequest | null;
}

/** What the run touches outside itself, so a test can run it in memory. */
export interface Deps {
  /** The REST API, or null when there is no token. */
  api: Api | null;
  /** A line of the job's log, where `::error::` and `::warning::` lines are annotations. */
  log: (line: string) => void;
  /** Markdown added to the job's summary. */
  summary: (markdown: string) => void;
  clone: (sibling: Sibling) => void;
  /** `aerie drift` with these arguments: its exit code and what it printed. */
  drift: (args: string[]) => Promise<{ code: number; out: string; err: string }>;
}

/** Text as a workflow command's message, where `%`, CR and LF are escaped. */
function command(text: string): string {
  return text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

/** The sticky comment of a model file that drift cannot check. */
export function cannotRunComment(file: string, message: string): string {
  return [
    commentMarker(file),
    `### ⚪ Aerie drift: \`${file}\``,
    '',
    'Drift cannot run:',
    '',
    ...fence(message.trimEnd().split('\n')),
    '',
  ].join('\n');
}

/** DRIFT-605: checks every model file and returns the worst exit code. */
export async function runAction(inputs: Inputs, context: Context, deps: Deps): Promise<number> {
  let worst = 0;
  for (const model of inputs.models) {
    worst = Math.max(worst, await checkModel(model, inputs, context, deps));
  }
  return worst;
}

async function checkModel(
  model: string,
  inputs: Inputs,
  context: Context,
  deps: Deps,
): Promise<number> {
  const { api, log } = deps;
  const { pr } = context;
  const warn = (what: string, error: unknown): void => {
    const why = error instanceof Error ? error.message : String(error);
    log(`::warning title=Aerie drift::${command(`${what} for ${model}: ${why}`)}`);
  };

  let code: number;
  let body: string;
  let document: DriftDocument | null = null;
  try {
    let system: System | null = null;
    try {
      system = parse(readFileSync(model, 'utf8')).model?.system ?? null;
    } catch {
      // `aerie drift` says why the file cannot be read.
    }
    const [owner = ''] = context.repository.split('/');
    for (const sibling of siblingsOf(model, system, inputs.repos, owner)) {
      log(`Checking out ${sibling.source.repository} as repo ${sibling.written}`);
      deps.clone(sibling);
    }
    const options = ['--fail-on', inputs.failOn];
    const json = await deps.drift(['drift', model, '--format', 'json', ...options]);
    const comment = await deps.drift(['drift', model, '--format', 'pr', ...options]);
    code = comment.code;
    body = code === 2 ? cannotRunComment(model, comment.err) : comment.out;
    if (code === 2) log(`::error title=Aerie drift::${command(comment.err.trimEnd())}`);
    else document = JSON.parse(json.out) as DriftDocument;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`::error title=Aerie drift::${command(message)}`);
    code = 2;
    body = cannotRunComment(model, message);
  }
  if (document !== null) {
    const { drift, likely } = document.summary;
    log(`${model}: ${String(drift)} drift, ${String(likely)} likely, exit code ${String(code)}`);
  }
  deps.summary(body);

  if (api === null || pr === null) return code;
  const found = document === null || document.summary.drift + document.summary.likely > 0;
  try {
    const done = await upsertComment(api, pr, commentMarker(model), body, inputs.comment, found);
    log(`The pull request comment for ${model}: ${done}`);
  } catch (error) {
    warn('Aerie could not post the pull request comment', error);
  }
  if (document === null || inputs.comment === 'never') return code;
  try {
    const path = slashes(relative(repositoryOf(dirname(resolve(model))), resolve(model)));
    const files = await listAll<{ filename: string; patch?: string }>(
      api,
      `/repos/${pr.owner}/${pr.repo}/pulls/${String(pr.number)}/files`,
    );
    const patch = files.find((each) => each.filename === path)?.patch;
    if (patch !== undefined) {
      const comments = suggestionComments(
        document,
        path,
        addedLines(patch),
        readFileSync(model, 'utf8'),
      );
      const posted = await postSuggestions(api, pr, model, comments);
      log(`Suggestions posted for ${model}: ${String(posted)} of ${String(comments.length)}`);
    }
  } catch (error) {
    warn('Aerie could not post its suggestions', error);
  }
  return code;
}

/** `aerie drift` run in this process, with what it prints kept. */
export async function driftInProcess(
  args: string[],
): Promise<{ code: number; out: string; err: string }> {
  const ran = { out: '', err: '' };
  const code = await run(args, {
    ...nodeIo,
    stdout: (text) => {
      ran.out += text;
    },
    stderr: (text) => {
      ran.err += text;
    },
    color: false,
  });
  return { code, ...ran };
}

/** The tokens' forms, kept for redacting what the action prints when it fails outside a run. */
let secrets: string[] = [];

async function main(env: NodeJS.ProcessEnv): Promise<number> {
  let inputs: Inputs;
  try {
    inputs = readInputs(env);
  } catch (error) {
    if (!(error instanceof BadInput)) throw error;
    process.stdout.write(`::error title=Aerie drift::${command(error.message)}\n`);
    return 2;
  }
  // DRIFT-606: masked first, so the job's log hides every form before anything else is printed,
  // and redacted from every line, summary and message as well.
  for (const line of maskCommands(inputs.token, inputs.reposToken)) {
    process.stdout.write(`${line}\n`);
  }
  secrets = secretForms(inputs.token, inputs.reposToken);
  const log = (line: string): void => {
    process.stdout.write(`${redact(line, secrets)}\n`);
  };
  const repository = env['GITHUB_REPOSITORY'] ?? '';
  const eventPath = env['GITHUB_EVENT_PATH'] ?? '';
  const event: unknown = eventPath === '' ? null : JSON.parse(readFileSync(eventPath, 'utf8'));
  const server = env['GITHUB_SERVER_URL'] ?? 'https://github.com';
  const append = (name: string, text: string): void => {
    const file = env[name] ?? '';
    if (file !== '') appendFileSync(file, text);
  };
  const code = await runAction(
    inputs,
    { repository, pr: pullRequestOf(repository, event) },
    {
      api:
        inputs.token === ''
          ? null
          : restApi(env['GITHUB_API_URL'] ?? 'https://api.github.com', inputs.token),
      log,
      summary: (markdown) => {
        append('GITHUB_STEP_SUMMARY', `${redact(markdown, secrets)}\n`);
      },
      clone: (sibling) => {
        cloneSibling(sibling, server, inputs.reposToken);
      },
      drift: driftInProcess,
    },
  );
  return code;
}

if (import.meta.main) {
  void main(process.env).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stdout.write(
        `::error title=Aerie drift::${command(redact(error instanceof Error ? error.message : String(error), secrets))}\n`,
      );
      process.exitCode = 2;
    },
  );
}
