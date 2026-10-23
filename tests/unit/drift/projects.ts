// Small in-memory projects for drift's unit tests: a workspace at `/w` that is its own repository,
// with a root pom and its modules, and a Compose file, written as briefly as the tests need.

export interface ModuleSpec {
  /** The artifactId, which is also the module's folder. */
  name: string;
  packaging?: string;
  /** In-system dependencies, by artifactId, with a scope when it is not `compile`. */
  deps?: (string | [string, string])[];
  /** Java files by path under `src/main/java`, each as its lines. */
  java?: Record<string, string[]>;
  /** `application.yml` lines. */
  config?: string[];
}

/** A Maven build at `/w`: the root pom lists every module. */
export function maven(...modules: ModuleSpec[]): Record<string, string> {
  const files: Record<string, string> = {
    '/w/pom.xml': [
      '<project>',
      '  <groupId>g</groupId>',
      '  <artifactId>root</artifactId>',
      '  <version>1</version>',
      '  <packaging>pom</packaging>',
      '  <modules>',
      ...modules.map((each) => `    <module>${each.name}</module>`),
      '  </modules>',
      '</project>',
      '',
    ].join('\n'),
  };
  for (const module of modules) {
    const deps = (module.deps ?? []).map((each) => {
      const [name, scope] = typeof each === 'string' ? [each, null] : each;
      const scoped = scope === null ? '' : `<scope>${scope}</scope>`;
      return `    <dependency><groupId>g</groupId><artifactId>${name}</artifactId>${scoped}</dependency>`;
    });
    files[`/w/${module.name}/pom.xml`] = [
      '<project>',
      '  <parent><groupId>g</groupId><artifactId>root</artifactId><version>1</version></parent>',
      `  <artifactId>${module.name}</artifactId>`,
      ...(module.packaging === undefined ? [] : [`  <packaging>${module.packaging}</packaging>`]),
      '  <dependencies>',
      ...deps,
      '  </dependencies>',
      '</project>',
      '',
    ].join('\n');
    for (const [path, lines] of Object.entries(module.java ?? {})) {
      files[`/w/${module.name}/src/main/java/${path}`] = [...lines, ''].join('\n');
    }
    if (module.config !== undefined) {
      files[`/w/${module.name}/src/main/resources/application.yml`] = [...module.config, ''].join(
        '\n',
      );
    }
  }
  return files;
}

/** A Compose file at `/w/compose.yaml`, the one the system reads by default. */
export function compose(...lines: string[]): Record<string, string> {
  return { '/w/compose.yaml': [...lines, ''].join('\n') };
}

/** A Java class in a package, with its imports and body lines. */
export function javaClass(pkg: string, imports: string[], ...body: string[]): string[] {
  return [`package ${pkg};`, '', ...imports.map((each) => `import ${each};`), '', ...body];
}

/** The Spring Boot application of a package. */
export function bootApp(pkg: string, name: string): string[] {
  return javaClass(
    pkg,
    ['org.springframework.boot.autoconfigure.SpringBootApplication'],
    '@SpringBootApplication',
    `public class ${name} {}`,
  );
}
