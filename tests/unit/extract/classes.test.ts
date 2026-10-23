// The class graph drift reads from the Java (docs/spec/drift.md, DRIFT-401 and DRIFT-402).
import { describe, expect, it } from 'vitest';
import { factText } from '../../../src/extract/index.ts';
import { extractFrom } from './memory.ts';

const POM = [
  '<project>',
  '  <groupId>g</groupId>',
  '  <artifactId>root</artifactId>',
  '  <packaging>pom</packaging>',
  '  <modules><module>app</module><module>lib</module></modules>',
  '</project>',
].join('\n');

const MODULE = (name: string, deps: string[] = []): string =>
  [
    '<project>',
    '  <parent><groupId>g</groupId><artifactId>root</artifactId></parent>',
    `  <artifactId>${name}</artifactId>`,
    '  <dependencies>',
    ...deps.map(
      (each) => `    <dependency><groupId>g</groupId><artifactId>${each}</artifactId></dependency>`,
    ),
    '  </dependencies>',
    '</project>',
  ].join('\n');

/** The class graph facts of a workspace with an `app` module that depends on a `lib` module. */
function graph(app: Record<string, string[]>, lib: Record<string, string[]>): string[] {
  const files: Record<string, string> = {
    '/w/pom.xml': POM,
    '/w/app/pom.xml': MODULE('app', ['lib']),
    '/w/lib/pom.xml': MODULE('lib'),
  };
  for (const [path, lines] of Object.entries(app))
    files[`/w/app/src/main/java/${path}`] = lines.join('\n');
  for (const [path, lines] of Object.entries(lib))
    files[`/w/lib/src/main/java/${path}`] = lines.join('\n');
  return extractFrom(files)
    .facts.filter((fact) => fact.kind === 'class' || fact.kind === 'reference')
    .map((fact) => factText(fact));
}

describe('the class graph', () => {
  it('DRIFT-401 each type a module declares, nested ones too, with its supertypes in the system', () => {
    expect(
      graph(
        {
          'a/Orders.java': [
            'package a;',
            'import b.Port;',
            'public class Orders extends Base implements Port, java.io.Serializable {',
            '  record Line(String sku) {}',
            '  enum State { OPEN }',
            '}',
          ],
          'a/Base.java': ['package a;', 'abstract class Base {}'],
        },
        {
          'b/Port.java': ['package b;', 'public interface Port {}'],
          'b/Mark.java': ['package b;', '@interface Mark {}'],
        },
      ),
    ).toEqual([
      'w/app/src/main/java/a/Base.java:2  Java type: maven:app declares class a.Base',
      'w/app/src/main/java/a/Orders.java:3  Java type: maven:app declares class a.Orders, a subtype of a.Base, b.Port',
      'w/app/src/main/java/a/Orders.java:4  Java type: maven:app declares record a.Orders.Line',
      'w/app/src/main/java/a/Orders.java:5  Java type: maven:app declares enum a.Orders.State',
      'w/lib/src/main/java/b/Mark.java:2  Java type: maven:lib declares annotation b.Mark',
      'w/lib/src/main/java/b/Port.java:2  Java type: maven:lib declares interface b.Port',
    ]);
  });

  it('DRIFT-402 each type of the system a type names, once, at the first line, its own code and supertypes aside', () => {
    const facts = graph(
      {
        'a/Orders.java': [
          'package a;',
          'import b.*;',
          'import java.util.List;',
          '@Mark',
          'public class Orders extends Base {',
          '  private final List<Line> lines = List.of();',
          '  private Prices prices;',
          '  Orders(Ledger ledger) {}',
          '  Total total(Draft draft) {',
          '    Local local = new Local();',
          '    Runnable run = () -> { Later later = null; };',
          '    return Totals.of(Limits.MAX, Kind.class);',
          '  }',
          '  record Line(String sku) {}',
          '}',
        ],
        'a/Base.java': ['package a;', 'class Base {}'],
      },
      Object.fromEntries(
        [
          'Mark',
          'Prices',
          'Ledger',
          'Total',
          'Draft',
          'Local',
          'Later',
          'Totals',
          'Limits',
          'Kind',
        ].map((name) => [`b/${name}.java`, ['package b;', `public class ${name} {}`]]),
      ),
    ).filter((line) => line.includes('Java type reference'));
    expect(facts.map((line) => line.replace(/^\S+ {2}Java type reference: /, ''))).toEqual([
      'maven:app a.Orders uses b.Mark in maven:lib',
      'maven:app a.Orders uses b.Prices in maven:lib',
      'maven:app a.Orders uses b.Ledger in maven:lib',
      'maven:app a.Orders uses b.Draft in maven:lib',
      'maven:app a.Orders uses b.Total in maven:lib',
      'maven:app a.Orders uses b.Local in maven:lib',
      'maven:app a.Orders uses b.Later in maven:lib',
      'maven:app a.Orders uses b.Kind in maven:lib',
      'maven:app a.Orders uses b.Limits in maven:lib',
      'maven:app a.Orders uses b.Totals in maven:lib',
    ]);
    // The superclass is in the type fact, and `Line` is the class's own code.
    expect(
      facts.some((line) => line.includes('uses a.Base') || line.includes('uses a.Orders.Line')),
    ).toBe(false);
  });
});
