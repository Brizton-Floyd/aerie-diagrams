// The extractor (docs/spec/drift.md, section 4): reads a project statically and returns facts, each
// with its evidence (`repo/path:line`) and the technique that found it. Pure TypeScript like the
// language and the model: it builds only on src/lines/index.ts and the parsers it is allowed
// (`yaml`, `dockerfile-ast`, `jsonc-parser`, `typescript`, `@xmldom/xmldom`, `properties-file`,
// `web-tree-sitter`), and reads files only through `ProjectFiles`.
//
// How drift (slices D5 and D6) uses it:
//
//   const model = parse(source).model;                       // the system root and code lines
//   const found = extract({ system: model.system, modelFolder, homeRepo, files });
//   // found.facts: services, ports, builds, the source each image is built from, connections and
//   //   more, sorted; `factText(fact)` prints `repo/path:line  technique: detail`.
//   // found.problems: errors (drift cannot run) and warnings (what is not checked).
//
// - Files are read through `ProjectFiles`, with absolute, forward-slash paths; the Node version is
//   `projectFiles` in src/cli/project.ts, which also finds the repository that holds a model.
// - Each technique is in `TECHNIQUES`; one that only corroborates (`depends_on`) never counts as
//   evidence on its own when D5 counts how many techniques agree.
// - Only the Compose files the system root names are read, or else the default ones in each repo's
//   root (DRIFT-007). node/ (D4) then reads each repo's package.json and what it leads to: npm
//   workspaces, angular.json, proxy files, the TypeScript an application imports, and the nginx in
//   the images Compose builds, which `composeFacts` describes for it as `ComposeView`s.
// - Maven and Spring (D3): each repo's root `pom.xml` and its modules (maven/), then each module's
//   configuration and Java (spring/). Java is read with a WebAssembly parser that loads
//   asynchronously, so a caller passes `java: await loadJava()`; without it the Java is not read.
export { extract, type Extraction } from './extract.ts';
export {
  evidenceText,
  factDetail,
  factText,
  placeText,
  sortFacts,
  unitText,
  type AngularAppFact,
  type AngularCallFact,
  type AppFact,
  type BuildFact,
  type CallFact,
  type ChannelFact,
  type ConnectionFact,
  type DependencyFact,
  type EndpointFact,
  type EventFact,
  type Evidence,
  type Fact,
  type FrameworkFact,
  type HealthcheckFact,
  type ImageFact,
  type ModuleFact,
  type Place,
  type PortFact,
  type ProfileFact,
  type ProjectFact,
  type PropertyFact,
  type ScheduleFact,
  type SourceFact,
  type SpringAppFact,
  type SpringCallFact,
  type UnitFact,
  type VolumeFact,
} from './facts.ts';
export { PROBLEMS, type Problem, type ProblemId } from './problems.ts';
export { JAVA_GRAMMAR, loadJava, type JavaParser } from './java/syntax.ts';
export {
  DEFAULT_COMPOSE_FILES,
  DEFAULT_OVERRIDE_FILES,
  type ExtractInput,
  type ProjectFiles,
  type Repo,
} from './project.ts';
export { TECHNIQUES, type Technique, type TechniqueId } from './techniques.ts';
