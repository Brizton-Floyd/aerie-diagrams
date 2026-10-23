// The Maven modules and their dependencies, read from the raw poms (docs/spec/drift.md, slice D3).
import { describe, expect, it } from 'vitest';
import { evidenceText } from '../../../src/extract/index.ts';
import { extractFrom, factLines } from './memory.ts';

/** A pom from the lines inside its `project` element. */
const pom = (...lines: string[]): string =>
  [
    '<?xml version="1.0"?>',
    '<project>',
    ...lines.map((line) => `  ${line}`),
    '</project>',
    '',
  ].join('\n');

const parent = (artifact = 'shop'): string =>
  `<parent><groupId>com.shop</groupId><artifactId>${artifact}</artifactId><version>1</version></parent>`;

const dependency = (group: string, artifact: string, ...more: string[]): string =>
  `<dependency><groupId>${group}</groupId><artifactId>${artifact}</artifactId>${more.join('')}</dependency>`;

const problemLines = (found: ReturnType<typeof extractFrom>): string[] =>
  found.problems.map(
    (each) => `${each.at === null ? '-' : evidenceText(each.at)}  ${each.message}`,
  );

describe('Maven modules', () => {
  it('DRIFT-201 the root pom of each repo and the modules it lists, recursively, profiles and Maven 4 subprojects too', () => {
    const lines = factLines({
      '/w/pom.xml': pom(
        '<groupId>com.shop</groupId>',
        '<artifactId>shop</artifactId>',
        '<packaging>pom</packaging>',
        '<modules><module>api</module><module>tools/pom.xml</module></modules>',
        '<profiles><profile><modules><module>legacy</module></modules></profile></profiles>',
      ),
      '/w/api/pom.xml': pom(
        parent(),
        '<artifactId>shop-api</artifactId>',
        '<subprojects><subproject>core</subproject></subprojects>',
      ),
      '/w/api/core/pom.xml': pom(parent('shop-api'), '<artifactId>shop-core</artifactId>'),
      '/w/tools/pom.xml': pom(parent(), '<artifactId>shop-tools</artifactId>'),
      '/w/legacy/pom.xml': pom(
        parent(),
        '<artifactId>shop-legacy</artifactId>',
        '<packaging>war</packaging>',
      ),
      // Not listed by any pom, so not part of the build.
      '/w/stray/pom.xml': pom('<groupId>x</groupId><artifactId>stray</artifactId>'),
    });
    expect(lines).toEqual([
      'w/api/core/pom.xml:4  Maven module: maven:shop-core',
      'w/api/core/pom.xml:4  Maven module: maven:shop-core is packaged as jar in w/api/core (parent maven:shop-api)',
      'w/api/pom.xml:4  Maven module: maven:shop-api',
      'w/api/pom.xml:4  Maven module: maven:shop-api is packaged as jar in w/api (parent maven:shop)',
      'w/legacy/pom.xml:4  Maven module: maven:shop-legacy',
      'w/legacy/pom.xml:5  Maven module: maven:shop-legacy is packaged as war in w/legacy (parent maven:shop)',
      'w/pom.xml:4  Maven module: maven:shop',
      'w/pom.xml:5  Maven module: maven:shop is packaged as pom in w',
      'w/tools/pom.xml:4  Maven module: maven:shop-tools',
      'w/tools/pom.xml:4  Maven module: maven:shop-tools is packaged as jar in w/tools (parent maven:shop)',
    ]);
  });

  it('DRIFT-201 a module the pom lists without a pom is a warning, and a repo without a root pom has no Maven facts', () => {
    const found = extractFrom(
      {
        '/w/a/pom.xml': pom(
          '<groupId>g</groupId><artifactId>a</artifactId>',
          '<modules><module>gone</module></modules>',
        ),
        '/w/b/core/pom.xml': pom('<groupId>g</groupId><artifactId>core</artifactId>'),
      },
      'repo a',
      'repo b',
    );
    expect(found.facts.map((fact) => fact.kind)).toEqual(['unit', 'module']);
    expect(problemLines(found)).toEqual([
      'a/pom.xml:4  The pom lists the module `gone`, but there is no `gone/pom.xml`, so it is not checked.',
    ]);
  });

  it('DRIFT-202 a pom that is not well-formed XML, or not a project, is a warning and its module is not read', () => {
    const found = extractFrom({
      '/w/pom.xml': pom(
        '<groupId>g</groupId><artifactId>root</artifactId>',
        '<modules><module>broken</module><module>other</module></modules>',
      ),
      '/w/broken/pom.xml': '<project>\n  <artifactId>broken\n</project>\n',
      '/w/other/pom.xml': '<settings/>\n',
    });
    expect(found.facts.filter((fact) => fact.kind === 'unit').length).toBe(1);
    expect(problemLines(found).map((line) => line.replace(/\(.*\)/, '(...)'))).toEqual([
      'w/broken/pom.xml:2  This pom cannot be read (...), so its module and what it holds are not checked.',
      'w/other/pom.xml:1  This pom cannot be read (...), so its module and what it holds are not checked.',
    ]);
  });

  it('DRIFT-202 a module inherits its group, version, properties and dependencies from a parent in the system, found by relativePath', () => {
    const lines = factLines({
      '/w/pom.xml': pom(
        '<groupId>com.shop</groupId>',
        '<artifactId>shop</artifactId>',
        '<version>2.1</version>',
        '<packaging>pom</packaging>',
        '<properties><core.name>shop-core</core.name><test.scope>test</test.scope></properties>',
        '<modules><module>core</module><module>web</module></modules>',
        `<dependencies>${dependency('org.slf4j', 'slf4j-api')}</dependencies>`,
      ),
      '/w/core/pom.xml': pom(parent(), '<artifactId>${core.name}</artifactId>'),
      '/w/web/pom.xml': pom(
        // The parent is the folder above by default; this one points at the root again.
        '<parent><groupId>com.shop</groupId><artifactId>shop</artifactId><relativePath>../pom.xml</relativePath></parent>',
        '<artifactId>shop-web</artifactId>',
        '<dependencies>',
        `  ${dependency('${project.groupId}', '${core.name}', '<version>${project.version}</version>')}`,
        `  ${dependency('org.slf4j', 'slf4j-api', '<scope>${test.scope}</scope>')}`,
        '</dependencies>',
      ),
    });
    expect(lines.filter((line) => line.includes('depends on'))).toEqual([
      'w/pom.xml:9  Maven dependency: maven:shop depends on org.slf4j:slf4j-api (compile)',
      'w/pom.xml:9  Maven dependency: maven:shop-core depends on org.slf4j:slf4j-api (compile)',
      'w/web/pom.xml:6  Maven dependency: maven:shop-web depends on maven:shop-core (compile)',
      'w/web/pom.xml:7  Maven dependency: maven:shop-web depends on org.slf4j:slf4j-api (test)',
    ]);
  });

  it("DRIFT-202 a parent outside the system, such as Spring Boot's, adds nothing, and two poms of one module keep the first", () => {
    const found = extractFrom(
      {
        '/w/a/pom.xml': pom(
          '<parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId><version>4.0.0</version><relativePath/></parent>',
          '<groupId>com.shop</groupId><artifactId>shop</artifactId>',
        ),
        '/w/b/pom.xml': pom('<groupId>com.shop</groupId><artifactId>shop</artifactId>'),
      },
      'repo a',
      'repo b',
    );
    expect(
      found.facts.filter((fact) => fact.kind === 'module').map((fact) => evidenceText(fact.at)),
    ).toEqual(['a/pom.xml:4']);
    expect(problemLines(found)).toEqual([
      'b/pom.xml:3  Another pom of the system declares the module `maven:shop` already; the first one is kept.',
    ]);
  });

  it('DRIFT-203 each dependency with its scope and optional flag, to a module of the system or an outside artifact; dependency management adds none', () => {
    const lines = factLines(
      {
        '/w/core/pom.xml': pom('<groupId>com.shop</groupId><artifactId>core</artifactId>'),
        '/w/web/pom.xml': pom(
          '<groupId>com.shop</groupId><artifactId>web</artifactId>',
          '<dependencies>',
          `  ${dependency('com.shop', 'core', '<scope>runtime</scope>', '<optional>true</optional>')}`,
          `  ${dependency('com.other', 'core')}`,
          `  ${dependency('org.junit.jupiter', 'junit-jupiter', '<scope>test</scope>')}`,
          '</dependencies>',
          `<dependencyManagement><dependencies>${dependency('com.shop', 'bom', '<scope>import</scope>')}</dependencies></dependencyManagement>`,
        ),
      },
      'repo core',
      'repo web',
    );
    expect(lines.filter((line) => line.includes('depends on'))).toEqual([
      'web/pom.xml:5  Maven dependency: maven:web depends on maven:core (runtime, optional)',
      'web/pom.xml:6  Maven dependency: maven:web depends on com.other:core (compile)',
      'web/pom.xml:7  Maven dependency: maven:web depends on org.junit.jupiter:junit-jupiter (test)',
    ]);
  });
});
