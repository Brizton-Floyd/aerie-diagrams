// Facts: what the extractor found in the code, each with its evidence and the technique that found
// it (docs/spec/drift.md, section 4, DRIFT-001 and DRIFT-002).
import type { CodeUnit } from '../lines/index.ts';
import { TECHNIQUES, type TechniqueId } from './techniques.ts';

/**
 * A file or folder of the system. `repo` is the repo's name and `path` the path inside it (`.` for
 * the repo itself); a place outside every repo of the system has no repo, and its path is absolute.
 */
export interface Place {
  repo: string | null;
  path: string;
}

/** Where a fact was found: a line of a file, printed `repo/path:line`. Lines count from 1. */
export interface Evidence extends Place {
  line: number;
}

interface Found<K extends string> {
  kind: K;
  technique: TechniqueId;
  at: Evidence;
}

/** The Compose project's name: its `name`, or else its folder's name as Compose writes it. */
export interface ProjectFact extends Found<'project'> {
  name: string;
}

/** A code unit exists: a Compose service. */
export interface UnitFact extends Found<'unit'> {
  unit: CodeUnit;
}

/** The image a service runs. */
export interface ImageFact extends Found<'image'> {
  unit: CodeUnit;
  image: string;
}

/** A port a service listens on (`target`), and where the host publishes it, if it does. */
export interface PortFact extends Found<'port'> {
  unit: CodeUnit;
  target: string;
  protocol: string;
  /**
   * Where the host publishes it: a port or range (null when the host picks a free one) and the
   * host address it binds, if one is given; null when the port is only open to the other services.
   */
  published: { port: string | null; hostIp: string | null } | null;
}

/** Where a service's image is built: its build context, Dockerfile and target stage. */
export interface BuildFact extends Found<'build'> {
  unit: CodeUnit;
  /** The build context, or null when it is not a folder (a Git URL, say: then `remote` holds it). */
  context: Place | null;
  remote: string | null;
  /** The Dockerfile, or null when the context is remote or the Dockerfile is written inline. */
  dockerfile: Place | null;
  target: string | null;
}

/** Source a service's image is built from: what a stage it builds copies in. */
export interface SourceFact extends Found<'source'> {
  unit: CodeUnit;
  place: Place;
  /** The Dockerfile stage that copies it, when the stage has a name. */
  stage: string | null;
}

/** One service names another, or a host outside the system: a likely call. */
export interface ConnectionFact extends Found<'connection'> {
  from: CodeUnit;
  to: CodeUnit | { host: string };
  /** The environment variable (or link alias) that names it, and its value with secrets hidden. */
  key: string | null;
  value: string | null;
}

/** A volume, folder or other mount a service uses. */
export interface VolumeFact extends Found<'volume'> {
  unit: CodeUnit;
  type: string;
  /** A named volume (or an image, for an image mount), or null. */
  name: string | null;
  /** The folder of a bind mount, or null. */
  place: Place | null;
  target: string;
}

/** A Compose profile a service belongs to: it starts only when the profile is chosen. */
export interface ProfileFact extends Found<'profile'> {
  unit: CodeUnit;
  profile: string;
}

/** The command that checks a service's health. It names the service itself, never another. */
export interface HealthcheckFact extends Found<'healthcheck'> {
  unit: CodeUnit;
  test: string;
}

export type Fact =
  | ProjectFact
  | UnitFact
  | ImageFact
  | PortFact
  | BuildFact
  | SourceFact
  | ConnectionFact
  | VolumeFact
  | ProfileFact
  | HealthcheckFact;

/** `kind:name`, as a code line writes a code unit. */
export function unitText(unit: CodeUnit): string {
  return `${unit.kind}:${unit.name}`;
}

/** `repo/path`, or the repo alone for the repo itself. */
export function placeText(place: Place): string {
  if (place.repo === null) return place.path;
  return place.path === '.' ? place.repo : `${place.repo}/${place.path}`;
}

/** `repo/path:line`, as a report prints evidence. */
export function evidenceText(at: Evidence): string {
  return `${placeText(at)}:${String(at.line)}`;
}

/** What a fact says, in the words a report prints after its evidence (DRIFT-002). */
export function factDetail(fact: Fact): string {
  switch (fact.kind) {
    case 'project':
      return fact.name;
    case 'unit':
      return unitText(fact.unit);
    case 'image':
      return `${unitText(fact.unit)} runs ${fact.image}`;
    case 'port': {
      const port = `${fact.target}/${fact.protocol}`;
      const published = fact.published;
      if (published === null) return `${unitText(fact.unit)} exposes ${port}`;
      if (published.port === null) return `${unitText(fact.unit)} publishes ${port} on a free port`;
      const ip = published.hostIp?.includes(':') ? `[${published.hostIp}]` : published.hostIp;
      const host = ip === null ? published.port : `${ip}:${published.port}`;
      return `${unitText(fact.unit)} publishes ${port} on ${host}`;
    }
    case 'build': {
      const from = fact.context === null ? (fact.remote ?? '?') : placeText(fact.context);
      const how = [
        fact.dockerfile === null ? null : placeText(fact.dockerfile),
        fact.target === null ? null : `target ${fact.target}`,
      ].filter((each) => each !== null);
      return `${unitText(fact.unit)} builds in ${from}${how.length > 0 ? ` (${how.join(', ')})` : ''}`;
    }
    case 'source': {
      const stage = fact.stage === null ? '' : ` (stage ${fact.stage})`;
      return `${unitText(fact.unit)} is built from ${placeText(fact.place)}${stage}`;
    }
    case 'connection': {
      const to = 'host' in fact.to ? `host ${fact.to.host}` : unitText(fact.to);
      const why =
        fact.key === null
          ? ''
          : ` (${fact.value === null ? fact.key : `${fact.key}=${fact.value}`})`;
      return `${unitText(fact.from)} to ${to}${why}`;
    }
    case 'volume': {
      const what =
        fact.place !== null
          ? `folder ${placeText(fact.place)}`
          : fact.name !== null
            ? `${fact.type} ${fact.name}`
            : fact.type;
      return `${unitText(fact.unit)} mounts ${what} at ${fact.target}`;
    }
    case 'profile':
      return `${unitText(fact.unit)} is in profile ${fact.profile}`;
    case 'healthcheck':
      return `${unitText(fact.unit)} checks itself with ${fact.test}`;
  }
}

/** A fact as one line of a report: `repo/path:line  technique: detail` (DRIFT-002). */
export function factText(fact: Fact): string {
  return `${evidenceText(fact.at)}  ${TECHNIQUES[fact.technique].name}: ${factDetail(fact)}`;
}

/** Facts in a stable order: by evidence, files outside the repos last, then by what they say (DRIFT-004). */
export function sortFacts(facts: readonly Fact[]): Fact[] {
  const key = (fact: Fact): [number, string, string, number, string] => [
    fact.at.repo === null ? 1 : 0,
    fact.at.repo ?? '',
    fact.at.path,
    fact.at.line,
    `${TECHNIQUES[fact.technique].name}: ${factDetail(fact)}`,
  ];
  return [...facts].sort((a, b) => {
    const [ka, kb] = [key(a), key(b)];
    for (let i = 0; i < ka.length; i++) {
      const [x, y] = [ka[i] ?? '', kb[i] ?? ''];
      if (x < y) return -1;
      if (x > y) return 1;
    }
    return 0;
  });
}
