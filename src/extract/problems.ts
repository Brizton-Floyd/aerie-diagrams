// What stops or limits extraction (docs/spec/drift.md, section 4, DRIFT-005), in plain English with
// the project's own names in backticks. An error means drift cannot run (exit code 2, section 7); a
// warning means part of the project could not be read, and what depends on it is not checked.
import type { Evidence } from './facts.ts';

export const PROBLEMS = {
  'missing-repo': (path: string) =>
    `The system root names the repo \`${path}\`, but there is no such folder.`,
  'missing-compose': (path: string) =>
    `The system root names the Compose file \`${path}\`, but there is no such file.`,
  'bad-yaml': (detail: string) => `This Compose file is not valid YAML: ${detail}`,
  'bad-compose': (what: string) => `This Compose file cannot be read: ${what}`,
  'missing-file': (what: string, path: string) =>
    `The ${what} \`${path}\` does not exist, so what it holds is not checked.`,
  'missing-dockerfile': (service: string, path: string) =>
    `The Dockerfile \`${path}\` of service \`${service}\` does not exist, so the source its image is built from is not checked.`,
  'inline-dockerfile': (service: string) =>
    `Service \`${service}\` writes its Dockerfile inline, so the source its image is built from is not checked.`,
  'remote-build': (service: string, context: string) =>
    `Service \`${service}\` is built from \`${context}\`, outside the system, so its source is not checked.`,
  'unknown-service': (service: string) =>
    `\`extends\` names the service \`${service}\`, which this file does not have, so nothing is taken from it.`,
  'extends-loop': (service: string) =>
    `Service \`${service}\` extends itself through \`extends\`, so nothing is taken from it.`,
  'include-conflict': (service: string) =>
    `An included Compose file declares service \`${service}\` again; the first one is kept.`,
  'unset-variable': (name: string) =>
    `\`${name}\` has no value here or in the \`.env\` file and no default, so it reads as empty: the value it sets is not checked.`,
} as const;

export type ProblemId = keyof typeof PROBLEMS;

export interface Problem {
  id: ProblemId;
  level: 'error' | 'warning';
  /** Where it is, when it is in a file. */
  at: Evidence | null;
  message: string;
}
