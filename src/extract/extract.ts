// The extractor's one entry point: a model's system root and read access to the project in, facts
// with evidence and problems out (docs/spec/drift.md, section 4; DRIFT-001 to DRIFT-007).
import { composeFacts, type ComposeView } from './compose/facts.ts';
import type { Loading } from './compose/load.ts';
import { factText, sortFacts, type Fact, type Place } from './facts.ts';
import { nodeFacts } from './node/facts.ts';
import type { Problem } from './problems.ts';
import { Locator, resolveSystem, type ExtractInput, type Repo } from './project.ts';

export interface Extraction {
  /** The repos of the system, as evidence names them. */
  repos: Repo[];
  /** Every file read, in order of path. */
  read: Place[];
  /** Every fact, once, in a stable order (DRIFT-004). */
  facts: Fact[];
  /** Errors stop drift (exit code 2); warnings name what is not checked (DRIFT-005). */
  problems: Problem[];
}

/** DRIFT-001: reads the system a model's system root names and returns what its code shows. */
export function extract(input: ExtractInput): Extraction {
  const system = resolveSystem(input);
  const locator = new Locator(system.repos);
  const loading: Loading = {
    files: input.files,
    locator,
    problems: [...system.problems],
    read: new Set(),
  };
  const facts: Fact[] = [];
  const views: ComposeView[] = [];
  for (const paths of system.compose) facts.push(...composeFacts(paths, loading, views));
  facts.push(...nodeFacts(system.repos, views, loading));
  const seen = new Set<string>();
  const once = sortFacts(facts).filter((fact) => {
    const key = factText(fact);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    repos: system.repos,
    read: [...loading.read].sort().map((path) => locator.place(path)),
    facts: once,
    problems: loading.problems,
  };
}
