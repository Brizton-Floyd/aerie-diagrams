// Java read with the WebAssembly parser into Aerie's own model, and names resolved as the compiler
// resolves them (docs/spec/drift.md, slice D3).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { evidenceText, extract, JAVA_GRAMMAR } from '../../../src/extract/index.ts';
import { Codebase } from '../../../src/extract/spring/code.ts';
import type { MavenModule } from '../../../src/extract/maven/reactor.ts';
import { java, memoryFiles } from './memory.ts';

const POM = '<project>\n  <groupId>g</groupId>\n  <artifactId>app</artifactId>\n</project>\n';

describe('Java', () => {
  it('DRIFT-208 a file reads into types, annotations, fields, methods and the expressions in them', () => {
    const file = java.read(
      [
        'package com.shop;',
        '',
        'import static com.shop.Paths.API;',
        'import java.util.*;',
        'import org.springframework.web.client.RestTemplate;',
        '',
        '@Component("x")',
        'public class Orders<T> extends Base implements Api, Other<T> {',
        '    private static final String PATH = API + "/orders\\t" + 1;',
        '    private final RestTemplate rest, spare;',
        '    record Line(@Value("${a}") String sku, int count) {}',
        '    public String get(final String id, String... more) {',
        '        var text = """',
        '            hello',
        '              world""";',
        '        Runnable run = () -> rest.getForObject(PATH, String.class);',
        '        return id == null ? PATH : text;',
        '    }',
        '}',
        '',
      ].join('\n'),
    );
    expect(file.package).toBe('com.shop');
    expect(file.imports).toEqual([
      { name: 'com.shop.Paths.API', isStatic: true, wildcard: false },
      { name: 'java.util', isStatic: false, wildcard: true },
      { name: 'org.springframework.web.client.RestTemplate', isStatic: false, wildcard: false },
    ]);
    const [orders] = file.types;
    expect(orders?.annotations).toEqual([
      {
        name: 'Component',
        line: 7,
        args: [{ name: 'value', value: { t: 'string', value: 'x', line: 7 } }],
      },
    ]);
    expect(orders?.superclass).toEqual({ name: 'Base', args: [] });
    expect(orders?.interfaces.map((each) => each.name)).toEqual(['Api', 'Other']);
    expect(
      orders?.fields.map((each) => [each.name, each.type.name, each.isStatic, each.isFinal]),
    ).toEqual([
      ['PATH', 'String', true, true],
      ['rest', 'RestTemplate', false, true],
      ['spare', 'RestTemplate', false, true],
    ]);
    expect(orders?.fields[0]?.value).toMatchObject({
      t: 'plus',
      parts: [
        { t: 'name', name: 'API' },
        { t: 'string', value: '/orders\t' },
        { t: 'other', text: '1' },
      ],
    });
    expect(
      orders?.types[0]?.components.map((each) => [each.name, each.annotations[0]?.name ?? null]),
    ).toEqual([
      ['sku', 'Value'],
      ['count', null],
    ]);
    const method = orders?.methods[0];
    expect(method?.params.map((each) => [each.name, each.type?.name])).toEqual([
      ['id', 'String'],
      ['more', 'String[]'],
    ]);
    expect(method?.body?.locals.map((each) => [each.name, each.type?.name ?? null])).toEqual([
      ['text', null],
      ['run', 'Runnable'],
    ]);
    expect(method?.body?.locals[0]?.value).toEqual({
      t: 'string',
      value: 'hello\n  world',
      line: 13,
    });
    expect(method?.body?.locals[1]?.value).toMatchObject({
      t: 'lambda',
      body: { returns: [{ t: 'call', name: 'getForObject', object: { t: 'name', name: 'rest' } }] },
    });
    expect(method?.body?.returns[0]).toMatchObject({ t: 'either' });
    expect(file.errors).toEqual([]);
  });

  it('DRIFT-208 a syntax error is recovered from, and its line kept', () => {
    const file = java.read('class A {\n  void a() {\n    int x = ;\n  }\n  void b() {}\n}\n');
    expect(file.types[0]?.methods.map((each) => each.name)).toEqual(['a', 'b']);
    expect(file.errors).toEqual([3]);
  });

  it('DRIFT-208 names resolve through nested types, single imports, the package and wildcard imports, in that order', () => {
    const code = new Codebase();
    const module = {} as MavenModule;
    const add = (path: string, text: string): void => {
      code.add({ path, java: java.read(text), module });
    };
    add(
      '/a/Orders.java',
      'package shop;\nimport other.Line;\nimport lib.*;\nclass Orders { static class Item {} }\n',
    );
    add('/a/Item.java', 'package shop;\nclass Item {}\n');
    add('/a/Price.java', 'package shop;\nclass Price {}\n');
    add('/b/Line.java', 'package other;\nclass Line {}\n');
    add('/c/Price.java', 'package lib;\nclass Price {}\nclass Tax {}\n');
    const orders = code.classes.get('shop.Orders');
    if (orders === undefined) throw new Error('no class');
    expect(code.resolve('Item', orders).name).toBe('shop.Orders.Item');
    expect(code.resolve('Line', orders).name).toBe('other.Line');
    expect(code.resolve('Price', orders).name).toBe('shop.Price');
    expect(code.resolve('Tax', orders).name).toBe('lib.Tax');
    expect(code.resolve('Orders.Item', orders).info?.name).toBe('shop.Orders.Item');
    // A type from outside the system is known by its import, or by a wildcard import of its package.
    const client = code.classes.get('other.Line');
    add(
      '/d/Client.java',
      'package d;\nimport org.springframework.web.client.*;\nclass Client {}\n',
    );
    const wild = code.classes.get('d.Client');
    if (client === undefined || wild === undefined) throw new Error('no class');
    expect(code.isType('RestTemplate', wild, ['org.springframework.web.client.RestTemplate'])).toBe(
      true,
    );
    expect(
      code.isType('RestTemplate', client, ['org.springframework.web.client.RestTemplate']),
    ).toBe(false);
  });

  it('DRIFT-208 the Java of each module is listed from its source folder; a syntax error, or a parser not loaded, is a warning', () => {
    const files = memoryFiles({
      '/w/pom.xml': POM,
      '/w/src/main/java/com/shop/App.java':
        'package com.shop;\n@SpringBootApplication\nclass App {}\n',
      '/w/src/main/java/com/shop/Broken.java':
        'package com.shop;\nclass Broken {\n  void x( {}\n}\n',
      '/w/src/main/java/com/shop/package-info.java': 'package com.shop;\n',
      '/w/src/test/java/com/shop/AppTest.java': 'class AppTest {}\n',
    });
    const found = extract({ system: null, modelFolder: '/w', homeRepo: '/w', files, java });
    expect(found.read.map((each) => each.path)).toEqual([
      'pom.xml',
      'src/main/java/com/shop/App.java',
      'src/main/java/com/shop/Broken.java',
    ]);
    expect(
      found.problems.map((each) => [each.id, each.at === null ? null : evidenceText(each.at)]),
    ).toEqual([['java-syntax', 'w/src/main/java/com/shop/Broken.java:3']]);
    const without = extract({
      system: null,
      modelFolder: '/w',
      homeRepo: '/w',
      files: memoryFiles({ '/w/pom.xml': POM, '/w/src/main/java/A.java': 'class A {}\n' }),
    });
    expect(without.problems.map((each) => each.message)).toEqual([
      'The Java parser was not loaded, so the Java source of `maven:app` is not checked.',
    ]);
  });

  it('DRIFT-215 the grammar kept in the repo is the published tree-sitter-java-orchard 0.5.22 file, unchanged', () => {
    const grammar = readFileSync(fileURLToPath(JAVA_GRAMMAR));
    expect(createHash('sha256').update(grammar).digest('hex')).toBe(
      '5975a019b815387c193aa13920ab03f8a47329611bcab2d0b15e3b75252c9996',
    );
    const notices = readFileSync('THIRD_PARTY_NOTICES.md', 'utf8');
    expect(notices).toContain('`tree-sitter-java-orchard` 0.5.22');
    expect(notices).toContain('5975a019b815387c193aa13920ab03f8a47329611bcab2d0b15e3b75252c9996');
  });

  it('DRIFT-215 the Maven and Spring parsers are pinned, MIT, with no dependencies of their own, and in the notices', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      dependencies: Record<string, string>;
    };
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as {
      packages: Record<string, { version: string; license?: string; dependencies?: object }>;
    };
    const notices = readFileSync('THIRD_PARTY_NOTICES.md', 'utf8');
    for (const name of ['web-tree-sitter', '@xmldom/xmldom', 'properties-file']) {
      const pinned = pkg.dependencies[name] ?? '';
      const installed = lock.packages[`node_modules/${name}`];
      expect(pinned, name).toMatch(/^\d+\.\d+\.\d+$/);
      expect(installed?.version, name).toBe(pinned);
      expect(installed?.license, name).toBe('MIT');
      expect(installed?.dependencies, name).toBeUndefined();
      expect(notices, name).toContain(`\`${name}\` ${pinned}`);
    }
    // The grammar is kept as a file, not installed: its package compiles a native add-on.
    expect(pkg.dependencies['tree-sitter-java-orchard']).toBeUndefined();
  });
});
