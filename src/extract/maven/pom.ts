// A pom read as written (DRIFT-202), with `@xmldom/xmldom`, which keeps the line of every element.
// Nothing is resolved here: the reactor (`reactor.ts`) fills in what a module inherits.
import { DOMParser, type Element } from '@xmldom/xmldom';

/** A value as written in the pom, with the line of its element. */
export interface Written {
  value: string;
  line: number;
}

export interface PomDependency {
  groupId: string | null;
  artifactId: string;
  scope: string | null;
  optional: boolean;
  line: number;
}

export interface Pom {
  line: number;
  groupId: Written | null;
  artifactId: Written | null;
  version: string | null;
  packaging: Written | null;
  parent: {
    groupId: string | null;
    artifactId: string | null;
    relativePath: string | null;
    line: number;
  } | null;
  /** `<modules>`, Maven 4's `<subprojects>`, and the modules of each profile, as written. */
  modules: Written[];
  properties: Map<string, string>;
  dependencies: PomDependency[];
  /** `<build><sourceDirectory>`, or null for Maven's default. */
  sourceDirectory: string | null;
  /** The `<directory>` of each `<build><resources><resource>`: folders copied onto the classpath. */
  classpath: string[];
}

export type PomRead =
  { pom: Pom; error: null } | { pom: null; error: { line: number; message: string } };

/** Reads a pom; a file that is not well-formed XML, or not a `project`, is an error. */
export function readPom(text: string): PomRead {
  let failure: { line: number; message: string } | null = null;
  const errorLine = (where: unknown): number => {
    const line = (where as { locator?: { lineNumber?: unknown } } | null)?.locator?.lineNumber;
    return typeof line === 'number' ? line : 1;
  };
  const parser = new DOMParser({
    onError(level, message, context) {
      if (level === 'warning' || failure !== null) return;
      failure = { line: errorLine(context), message };
    },
  });
  let root: Element | null = null;
  try {
    root = parser.parseFromString(text, 'text/xml').documentElement;
  } catch (error) {
    failure ??= {
      line: errorLine(error),
      message: error instanceof Error ? error.message : String(error),
    };
  }
  if (failure !== null) return { pom: null, error: failure };
  if (root?.localName !== 'project') {
    return { pom: null, error: { line: 1, message: 'its root element is not `project`' } };
  }
  return { pom: projectOf(root), error: null };
}

function projectOf(project: Element): Pom {
  const parent = child(project, 'parent');
  const build = child(project, 'build');
  const modules = [
    ...children(child(project, 'modules'), 'module'),
    ...children(child(project, 'subprojects'), 'subproject'),
    ...children(child(project, 'profiles'), 'profile').flatMap((profile) =>
      children(child(profile, 'modules'), 'module'),
    ),
  ];
  const properties = new Map<string, string>();
  for (const each of elements(child(project, 'properties'))) {
    properties.set(each.localName ?? '', textOf(each));
  }
  return {
    line: lineOf(project),
    groupId: written(child(project, 'groupId')),
    artifactId: written(child(project, 'artifactId')),
    version: valueOf(child(project, 'version')),
    packaging: written(child(project, 'packaging')),
    parent:
      parent === null
        ? null
        : {
            groupId: valueOf(child(parent, 'groupId')),
            artifactId: valueOf(child(parent, 'artifactId')),
            relativePath:
              child(parent, 'relativePath') === null ? null : textOf(child(parent, 'relativePath')),
            line: lineOf(parent),
          },
    modules: modules.flatMap((each) => {
      const value = textOf(each);
      return value === '' ? [] : [{ value, line: lineOf(each) }];
    }),
    properties,
    dependencies: children(child(project, 'dependencies'), 'dependency').flatMap((each) => {
      const artifactId = valueOf(child(each, 'artifactId'));
      if (artifactId === null) return [];
      return [
        {
          groupId: valueOf(child(each, 'groupId')),
          artifactId,
          scope: valueOf(child(each, 'scope')),
          optional: valueOf(child(each, 'optional')) === 'true',
          line: lineOf(each),
        },
      ];
    }),
    sourceDirectory: valueOf(child(build, 'sourceDirectory')),
    classpath: children(child(build, 'resources'), 'resource').flatMap((each) => {
      const directory = valueOf(child(each, 'directory'));
      return directory === null ? [] : [directory];
    }),
  };
}

function elements(parent: Element | null): Element[] {
  if (parent === null) return [];
  const out: Element[] = [];
  for (let node = parent.firstChild; node !== null; node = node.nextSibling) {
    if (node.nodeType === node.ELEMENT_NODE) out.push(node as Element);
  }
  return out;
}

function children(parent: Element | null, name: string): Element[] {
  return elements(parent).filter((each) => each.localName === name);
}

function child(parent: Element | null, name: string): Element | null {
  return children(parent, name)[0] ?? null;
}

function textOf(element: Element | null): string {
  return (element?.textContent ?? '').trim();
}

function valueOf(element: Element | null): string | null {
  const value = textOf(element);
  return element === null || value === '' ? null : value;
}

function written(element: Element | null): Written | null {
  const value = valueOf(element);
  return element === null || value === null ? null : { value, line: lineOf(element) };
}

function lineOf(element: Element): number {
  return element.lineNumber ?? 1;
}
