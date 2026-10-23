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
  'bad-json': (what: string, detail: string) =>
    `This ${what} is not valid JSON, so what it holds is not checked: ${detail}.`,
  'unnamed-package': () =>
    'This package.json has no `name`, so no code line can name the package, and its code is not checked.',
  'proxy-code': (path: string) =>
    `The dev-server proxy \`${path}\` is code, which drift never runs, so where it sends calls is not checked.`,
  interceptor: (names: string) =>
    `The HTTP interceptors here (${names}) may change where HttpClient calls go, which drift does not follow, so it checks their URLs as written.`,
  'unknown-url': (written: string) =>
    `The URL of this HTTP call, ${code(written)}, is known only at run time, so where it goes is not checked.`,
  'runtime-config': (path: string) =>
    `The app reads \`${path}\` from its own server at run time, which drift does not read, so the addresses it holds are not checked.`,
  'nginx-variable': (name: string) =>
    `\`${name}\` has no value drift can read, so where this proxy_pass sends calls is not checked.`,
  'bad-pom': (detail: string) =>
    `This pom cannot be read (${detail}), so its module and what it holds are not checked.`,
  'missing-module': (module: string, path: string) =>
    `The pom lists the module \`${module}\`, but there is no \`${path}\`, so it is not checked.`,
  'duplicate-module': (module: string) =>
    `Another pom of the system declares the module \`${module}\` already; the first one is kept.`,
  'bad-config': (detail: string) =>
    `This Spring configuration file is not valid YAML: ${detail}. What it sets is not checked.`,
  'unresolved-placeholder': (key: string, placeholder: string) =>
    `\`${key}\` takes its value from \`${placeholder}\`, which has no value in the configuration and no default, so the address it holds is not checked.`,
  'java-not-loaded': (unit: string) =>
    `The Java parser was not loaded, so the Java source of \`${unit}\` is not checked.`,
  'java-syntax': () =>
    `This Java file has a syntax error here, so what the code around it holds may be missed.`,
} as const;

/** Text in backticks, fenced with two when it holds one, as Markdown writes code. */
function code(text: string): string {
  return text.includes('`') ? `\`\` ${text} \`\`` : `\`${text}\``;
}

export type ProblemId = keyof typeof PROBLEMS;

export interface Problem {
  id: ProblemId;
  level: 'error' | 'warning';
  /** Where it is, when it is in a file. */
  at: Evidence | null;
  message: string;
}
