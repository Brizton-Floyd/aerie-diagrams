// The facts of the Maven modules (DRIFT-201 to DRIFT-203): each module as a code unit, its packaging
// and folder, and each dependency with its scope.
import type { Loading } from '../compose/load.ts';
import type { Fact } from '../facts.ts';
import { moduleNamed, type MavenModule } from './reactor.ts';

export function mavenFacts(modules: readonly MavenModule[], loading: Loading): Fact[] {
  const facts: Fact[] = [];
  for (const module of modules) {
    const at = loading.locator.evidence(module.pom, module.artifactLine);
    facts.push({ kind: 'unit', technique: 'maven-module', at, unit: module.unit });
    facts.push({
      kind: 'module',
      technique: 'maven-module',
      at: loading.locator.evidence(module.pom, module.packagingLine ?? module.artifactLine),
      unit: module.unit,
      packaging: module.packaging,
      folder: loading.locator.place(module.folder),
      parent: module.parent?.unit ?? null,
    });
    for (const each of module.dependencies) {
      const target = moduleNamed(modules, each.groupId, each.artifactId);
      if (target === module) continue;
      facts.push({
        kind: 'dependency',
        technique: 'maven-dependency',
        at: loading.locator.evidence(each.file, each.line),
        from: module.unit,
        to:
          target === undefined
            ? { artifact: `${each.groupId ?? '?'}:${each.artifactId}` }
            : target.unit,
        scope: each.scope,
        optional: each.optional,
      });
    }
  }
  return facts;
}
