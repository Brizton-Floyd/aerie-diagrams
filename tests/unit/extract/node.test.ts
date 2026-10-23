// The Node, Angular and nginx extractor, rule by rule (docs/spec/drift.md, "Node and Angular",
// DRIFT-301 to DRIFT-311). The fixture projects (fixtures.test.ts) hold the same rules on whole
// projects, and on copies of the Lotto UI.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readJson } from '../../../src/extract/node/json.ts';
import {
  envsubst,
  nginxConfig,
  parseNginx,
  proxyTargets,
  selectLocation,
} from '../../../src/extract/node/nginx.ts';
import { globPattern, readProxy } from '../../../src/extract/node/proxy.ts';
import { onHost } from '../../../src/extract/node/targets.ts';
import { extractFrom, factLines, memoryFiles, yaml } from './memory.ts';
import { extract } from '../../../src/extract/index.ts';

const ROOT = join(import.meta.dirname, '../../..');
const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n';
const lines = (...each: string[]): string => each.join('\n') + '\n';

/** An Angular workspace at `/w` whose one application starts from `src/main.ts`. */
function workspace(
  files: Record<string, string>,
  options: { build?: Record<string, unknown>; serve?: Record<string, unknown> } = {},
): Record<string, string> {
  return {
    '/w/package.json': json({ name: 'shop', dependencies: { '@angular/core': '^21.0.0' } }),
    '/w/angular.json': json({
      projects: {
        shop: {
          projectType: 'application',
          root: '',
          architect: {
            build: { options: { browser: 'src/main.ts', ...options.build } },
            serve: { options: options.serve ?? {} },
          },
        },
      },
    }),
    ...files,
  };
}

/** Only the facts of some techniques, for a short expectation. */
function only(found: string[], ...techniques: string[]): string[] {
  return found.filter((line) => techniques.some((each) => line.includes(`  ${each}: `)));
}

function problems(files: Record<string, string>, ...system: string[]): string[] {
  return extractFrom(files, ...system).problems.map(
    (each) =>
      `${each.at === null ? '-' : `${each.at.repo ?? ''}/${each.at.path}:${String(each.at.line)}`}  ${each.message}`,
  );
}

describe('JSON files', () => {
  it('DRIFT-301 JSON is read with comments and trailing commas, with the line of every value', () => {
    const found = readJson('/w/a.json', '// note\n{\n  "a": [1,],\n  /* b */ "b": "x",\n}\n');
    expect('json' in found && found.json.line(found.json.root.offset)).toBe(2);
    expect(readJson('/w/b.json', '{ "a": }')).toEqual({ error: 'ValueExpected at line 1' });
  });

  it('DRIFT-301 a package.json that is not valid JSON is a warning, and what it holds is not checked', () => {
    expect(problems({ '/w/package.json': '{\n  "name": "shop",\n  "x": [\n' })).toEqual([
      'w/package.json:1  This package.json is not valid JSON, so what it holds is not checked: CloseBracketExpected at line 4.',
    ]);
  });
});

describe('packages', () => {
  it('DRIFT-302 each named package is an npm code unit, with the frameworks it declares', () => {
    expect(
      factLines({
        '/w/package.json': lines(
          '{',
          '  "name": "@shop/api",',
          '  "dependencies": { "express": "^5.1.0", "zod": "^4.0.0" },',
          '  "devDependencies": { "express": "^4", "@angular/core": "^21.0.0" },',
          '  "peerDependencies": { "react": "^19" }',
          '}',
        ),
      }),
    ).toEqual([
      'w/package.json:2  package.json name: npm:@shop/api',
      'w/package.json:3  package.json dependency: npm:@shop/api uses Express ^5.1.0',
      'w/package.json:4  package.json dependency: npm:@shop/api uses Angular ^21.0.0',
      'w/package.json:5  package.json dependency: npm:@shop/api uses React ^19',
    ]);
  });

  it('DRIFT-302 workspaces: plain paths, `*` and `**` patterns and the packages form, never node_modules', () => {
    const found = factLines({
      '/w/package.json': json({
        workspaces: { packages: ['apps/*', 'tools/**', 'one', '!apps/skip'] },
      }),
      '/w/apps/web/package.json': json({ name: 'web' }),
      '/w/apps/node_modules/x/package.json': json({ name: 'not-a-workspace' }),
      '/w/apps/readme.md': 'not a folder',
      '/w/tools/a/b/package.json': json({ name: 'deep' }),
      '/w/tools/package.json': json({ name: 'tools' }),
      '/w/one/package.json': json({ name: 'one' }),
    });
    expect(found).toEqual([
      'w/apps/web/package.json:2  package.json name: npm:web',
      'w/one/package.json:2  package.json name: npm:one',
      'w/tools/a/b/package.json:2  package.json name: npm:deep',
      'w/tools/package.json:2  package.json name: npm:tools',
    ]);
  });

  it('DRIFT-302 a package an image is built from is read, even outside the repo roots', () => {
    const found = factLines(
      {
        '/w/compose.yaml': yaml('services:', '  web:', '    build: ./web'),
        '/w/web/Dockerfile': lines('FROM node:24', 'COPY app/ /srv/'),
        '/w/web/app/package.json': json({ name: 'web-app' }),
      },
      'repo .',
    );
    expect(only(found, 'package.json name')).toEqual([
      'w/web/app/package.json:2  package.json name: npm:web-app',
    ]);
  });

  it('DRIFT-302 a package without a name is no code unit, and a warning only when it has a framework', () => {
    expect(problems({ '/w/package.json': json({ private: true, workspaces: ['a'] }) })).toEqual([]);
    expect(problems({ '/w/package.json': json({ dependencies: { koa: '^3' } }) })).toEqual([
      'w/package.json:1  This package.json has no `name`, so no code line can name the package, and its code is not checked.',
    ]);
  });
});

describe('angular.json', () => {
  it('DRIFT-303 projects belong to the package that holds their root; targets and older option names are read', () => {
    const files = {
      '/w/package.json': json({ name: 'shop' }),
      '/w/libs/kit/package.json': json({ name: 'kit' }),
      '/w/angular.json': json({
        projects: {
          admin: {
            root: 'apps/admin',
            targets: { build: { options: { main: 'apps/admin/src/main.ts' } } },
          },
          kit: { projectType: 'library', root: 'libs/kit' },
        },
      }),
      '/w/apps/admin/src/main.ts': 'export {};\n',
    };
    expect(only(factLines(files), 'Angular project')).toEqual([
      'w/angular.json:3  Angular project: npm:shop has Angular application admin (w/apps/admin/src/main.ts)',
      'w/angular.json:13  Angular project: npm:kit has Angular library kit',
    ]);
  });

  it('DRIFT-303 a missing entry point or environment file is a warning', () => {
    const files = workspace(
      {},
      {
        build: {
          fileReplacements: [{ src: 'src/env.ts', replaceWith: 'src/env.prod.ts' }],
        },
      },
    );
    expect(problems(files)).toEqual([
      'w/angular.json:9  The entry point `src/main.ts` does not exist, so what it holds is not checked.',
    ]);
    files['/w/src/main.ts'] = 'export {};\n';
    expect(problems(files)).toEqual([
      'w/angular.json:12  The environment file `src/env.ts` does not exist, so what it holds is not checked.',
      'w/angular.json:13  The environment file `src/env.prod.ts` does not exist, so what it holds is not checked.',
    ]);
  });
});

describe('the dev-server proxy', () => {
  it('DRIFT-304 both forms, a string or object target, and where each route goes', () => {
    const found = factLines(
      workspace(
        {
          '/w/proxy.conf.json': lines(
            '{',
            '  "/api": { "target": "http://localhost:9000" },',
            '  "/auth": "http://auth:8000",',
            '  "/ext": { "target": { "host": "api.example.com", "protocol": "https:" } },',
            '  "/free": { "target": "http://localhost:4000" },',
            '}',
          ),
          '/w/src/main.ts': 'export {};\n',
          '/w/compose.yaml': yaml(
            'services:',
            '  api:',
            '    image: api',
            '    ports: ["9000:9000"]',
            '  auth:',
            '    image: auth',
          ),
        },
        { serve: { proxyConfig: 'proxy.conf.json' } },
      ),
    );
    expect(only(found, 'Angular dev-server proxy')).toEqual([
      'w/proxy.conf.json:2  Angular dev-server proxy: npm:shop to compose:api (/api=http://localhost:9000)',
      'w/proxy.conf.json:3  Angular dev-server proxy: npm:shop to compose:auth (/auth=http://auth:8000)',
      'w/proxy.conf.json:4  Angular dev-server proxy: npm:shop to host api.example.com (/ext=https://api.example.com)',
      'w/proxy.conf.json:5  Angular dev-server proxy: npm:shop to host localhost:4000 (/free=http://localhost:4000)',
    ]);
  });

  it('DRIFT-304 a context matches as a regular expression from ^, as a glob, or as a prefix', () => {
    const json = readJson(
      '/w/p.json',
      JSON.stringify({ '^/v[0-9]/': 'http://a', '/files/*.pdf': 'http://b', '/api': 'http://c' }),
    );
    if (!('json' in json)) throw new Error(json.error);
    const routes = readProxy(json.json);
    const match = (path: string): string[] =>
      routes.filter((each) => each.matches(path)).map((each) => each.context);
    expect(match('/v2/x')).toEqual(['^/v[0-9]/']);
    expect(match('/files/a.pdf')).toEqual(['/files/*.pdf']);
    expect(match('/files/a/b.pdf')).toEqual([]);
    expect(match('/apix')).toEqual(['/api']);
    expect(globPattern('/api/**').test('/api/a/b?c=1')).toBe(true);
    expect(globPattern('/{a,b}/x').test('/b/x')).toBe(true);
  });

  it('DRIFT-304 a proxy file that is code, or missing, is a warning', () => {
    const files = workspace(
      { '/w/src/main.ts': 'export {};\n' },
      { serve: { proxyConfig: 'proxy.conf.mjs' } },
    );
    expect(problems(files)).toEqual([
      'w/angular.json:14  The dev-server proxy `proxy.conf.mjs` is code, which drift never runs, so where it sends calls is not checked.',
    ]);
    const missing = workspace(
      { '/w/src/main.ts': 'export {};\n' },
      { serve: { proxyConfig: 'proxy.conf.json' } },
    );
    expect(problems(missing)).toEqual([
      'w/angular.json:14  The dev-server proxy file `proxy.conf.json` does not exist, so what it holds is not checked.',
    ]);
  });
});

describe('the code an application is built from', () => {
  it('DRIFT-305 only files the entry point imports are read: relative, by tsconfig paths, lazily, not type-only', () => {
    const files = memoryFiles(
      workspace(
        {
          '/w/tsconfig.base.json': json({
            compilerOptions: { baseUrl: 'src', paths: { '@lib/*': ['lib/*'] } },
          }),
          '/w/tsconfig.app.json': json({ extends: './tsconfig.base' }),
          '/w/src/main.ts': lines(
            "import { a } from './app/a.js';",
            "import type { T } from './app/types';",
            "import { lib } from '@lib/one';",
            "import { other } from 'rxjs';",
            "export const routes = [{ loadChildren: () => import('./app/lazy') }];",
          ),
          '/w/src/app/a.ts': "export * from './folder';\n",
          '/w/src/app/folder/index.ts': 'export const a = 1;\n',
          '/w/src/app/types.ts': 'export type T = 1;\n',
          '/w/src/app/lazy.ts': 'export default 1;\n',
          '/w/src/app/never.ts': 'export const never = 1;\n',
          '/w/src/lib/one.ts': 'export const lib = 1;\n',
          '/w/node_modules/rxjs/index.ts': 'export const other = 1;\n',
        },
        { build: { tsConfig: 'tsconfig.app.json' } },
      ),
    );
    const found = extract({ system: null, modelFolder: '/w', homeRepo: '/w', files });
    expect(found.read.map((each) => each.path).filter((path) => path.endsWith('.ts'))).toEqual([
      'src/app/a.ts',
      'src/app/folder/index.ts',
      'src/app/lazy.ts',
      'src/lib/one.ts',
      'src/main.ts',
    ]);
  });

  it('DRIFT-305 environment files: every address the build may use, from each file it swaps in', () => {
    const found = factLines(
      workspace(
        {
          '/w/src/main.ts': "import { environment } from './env';\nexport const e = environment;\n",
          '/w/src/env.ts': lines(
            'export const environment = {',
            "  api: 'http://localhost:9000',",
            "  sso: { url: 'https://login.example.com' + '/auth' },",
            "  path: '/relative',",
            '};',
          ),
          '/w/src/env.prod.ts': lines(
            'const host = "https://api.example.com";',
            'export const environment = { api: host, sso: { url: `${host}/sso` } } as const;',
          ),
        },
        { build: { fileReplacements: [{ replace: 'src/env.ts', with: 'src/env.prod.ts' }] } },
      ),
    );
    expect(only(found, 'Angular environment file')).toEqual([
      'w/src/env.prod.ts:2  Angular environment file: npm:shop to host api.example.com (environment.api=https://api.example.com)',
      'w/src/env.prod.ts:2  Angular environment file: npm:shop to host api.example.com (environment.sso.url=https://api.example.com/sso)',
      'w/src/env.ts:2  Angular environment file: npm:shop to host localhost:9000 (environment.api=http://localhost:9000)',
      'w/src/env.ts:3  Angular environment file: npm:shop to host login.example.com (environment.sso.url=https://login.example.com/auth)',
    ]);
  });
});

describe('HTTP calls', () => {
  /** The calls of an application whose `src/main.ts` holds `code`. */
  function calls(code: string, files: Record<string, string> = {}): string[] {
    return only(
      factLines(workspace({ '/w/src/main.ts': code, ...files })),
      'Angular HttpClient',
    ).map((line) => line.replace(/^w\/src\/main\.ts:/, ''));
  }

  it('DRIFT-306 a call counts only on a value the code declares as an HttpClient', () => {
    expect(
      calls(
        lines(
          "import { inject } from '@angular/core';",
          "import { HttpClient as Client, HttpParams } from '@angular/common/http';",
          'export class A {',
          '  private readonly http = inject(Client);',
          '  private readonly typed: Client;',
          '  private readonly map = new Map<string, string>();',
          '  constructor(private api: Client, plain: Client) {',
          "    plain.delete('/one');",
          '  }',
          "  a() { this.http.get('/two'); this.typed.patch('/three', {}); this.api.head('/four'); }",
          "  b() { this.map.get('/no'); const http = { get: (x: string) => x }; http.get('/no'); }",
          "  c() { const local: Client = this.http; local.options('/five'); this.http.jsonp('/six', 'cb'); }",
          '}',
        ),
      ),
    ).toEqual([
      '8  Angular HttpClient: npm:shop calls DELETE /one',
      '10  Angular HttpClient: npm:shop calls GET /two',
      '10  Angular HttpClient: npm:shop calls HEAD /four',
      '10  Angular HttpClient: npm:shop calls PATCH /three',
      '12  Angular HttpClient: npm:shop calls JSONP /six',
      '12  Angular HttpClient: npm:shop calls OPTIONS /five',
    ]);
  });

  it('DRIFT-306 request() takes its method, and httpResource its URL or request object', () => {
    expect(
      calls(
        lines(
          "import { HttpClient, httpResource } from '@angular/common/http';",
          'export class A {',
          '  constructor(private http: HttpClient) {}',
          "  a(m: string) { this.http.request('post', '/a'); this.http.request(m, '/b'); }",
          "  r = httpResource(() => '/c');",
          "  s = httpResource.text(() => ({ url: '/d', method: 'PUT' }));",
          '  t = httpResource(() => { return `/e`; });',
          '}',
        ),
      ),
    ).toEqual([
      '4  Angular HttpClient: npm:shop calls POST /a',
      '4  Angular HttpClient: npm:shop calls REQUEST /b',
      '5  Angular HttpClient: npm:shop calls GET /c',
      '6  Angular HttpClient: npm:shop calls PUT /d',
      '7  Angular HttpClient: npm:shop calls GET /e',
    ]);
  });

  it('DRIFT-306 URLs from literals, templates, +, ? :, constants, imports, class and object properties', () => {
    expect(
      calls(
        lines(
          "import { HttpClient } from '@angular/common/http';",
          "import { API, Paths } from './paths';",
          "const LOCAL = '/local';",
          'export class A {',
          "  static readonly ROOT = '/root';",
          "  private readonly base = API + '/v1';",
          '  constructor(private http: HttpClient) {}',
          '  a(id: string, flag: boolean) {',
          '    this.http.get(`${this.base}/items/${id}`);',
          "    this.http.get(flag ? LOCAL : A.ROOT + '/x');",
          '    this.http.get(Paths.orders.all);',
          '    this.http.get(`${id}/tail`);',
          '    this.http.get(String(id) + `/x`);',
          '  }',
          '}',
        ),
        {
          '/w/src/paths.ts':
            "export { API } from './api';\nexport const Paths = { orders: { all: '/orders' } };\n",
          '/w/src/api.ts': "const api = '/api';\nexport { api as API };\n",
        },
      ),
    ).toEqual([
      '9  Angular HttpClient: npm:shop calls GET /api/v1/items/{}',
      '10  Angular HttpClient: npm:shop calls GET /local',
      '10  Angular HttpClient: npm:shop calls GET /root/x',
      '11  Angular HttpClient: npm:shop calls GET /orders',
    ]);
  });

  it('DRIFT-306 a URL whose start is known only at run time, and an interceptor, are warnings', () => {
    expect(
      problems(
        workspace({
          '/w/src/main.ts': lines(
            "import { HttpClient, HTTP_INTERCEPTORS } from '@angular/common/http';",
            'export class A {',
            '  constructor(private http: HttpClient) {}',
            '  a(url: string) { return this.http.get(`${url}/x`); }',
            '}',
            'export const providers = [{ provide: HTTP_INTERCEPTORS, useClass: Auth, multi: true }];',
          ),
        }),
      ),
    ).toEqual([
      'w/src/main.ts:6  The HTTP interceptors here (`Auth`) may change where HttpClient calls go, which drift does not follow, so it checks their URLs as written.',
      'w/src/main.ts:4  The URL of this HTTP call, `` `${url}/x` ``, is known only at run time, so where it goes is not checked.',
    ]);
  });
});

describe('where a URL goes', () => {
  const network = {
    byName: new Map<string, string | null>([
      ['api', 'api'],
      ['twin', null],
    ]),
    published: new Map([
      ['9000', ['api']],
      ['80', ['web']],
      ['7000', ['a', 'b']],
    ]),
  };

  it('DRIFT-307 from the host: loopback through the published port, names to services, the rest outside', () => {
    expect(onHost('http://localhost:9000/x', network)).toEqual({ kind: 'compose', name: 'api' });
    expect(onHost('http://127.0.0.1', network)).toEqual({ kind: 'compose', name: 'web' });
    expect(onHost('http://localhost:7000', network)).toEqual({ host: 'localhost:7000' });
    expect(onHost('https://[::1]', network)).toEqual({ host: '::1:443' });
    expect(onHost('http://API:1/x', network)).toEqual({ kind: 'compose', name: 'api' });
    expect(onHost('http://twin', network)).toEqual({ host: 'twin' });
    expect(onHost('http://{}/x', network)).toBeNull();
  });

  it('DRIFT-307 relative calls go through the dev proxy and the nginx that serves the app', () => {
    const found = factLines(
      workspace(
        {
          '/w/src/main.ts': lines(
            "import { HttpClient } from '@angular/common/http';",
            'export class A {',
            '  constructor(private http: HttpClient) {}',
            "  a() { this.http.get('api/x'); this.http.get('/static/config.json'); this.http.get('/api/settings.json'); }",
            '}',
          ),
          '/w/proxy.json': json({ '/app/api': 'http://localhost:9000' }),
          '/w/compose.yaml': yaml(
            'services:',
            '  web:',
            '    build: .',
            '  api:',
            '    image: api',
            '    ports: ["9000:9000"]',
          ),
          '/w/Dockerfile': lines('FROM nginx', 'COPY default.conf /etc/nginx/conf.d/'),
          '/w/default.conf': lines(
            'server {',
            '  location /app/api/ { proxy_pass http://api:9000/; }',
            '  location /api/ { proxy_pass http://api:9000; }',
            '}',
          ),
        },
        { build: { baseHref: '/app' }, serve: { proxyConfig: 'proxy.json' } },
      ),
    );
    expect(
      only(found, 'Angular HttpClient through the dev proxy', 'Angular HttpClient through nginx'),
    ).toEqual([
      'w/src/main.ts:4  Angular HttpClient through nginx: npm:shop to compose:api (GET /api/settings.json)',
      'w/src/main.ts:4  Angular HttpClient through nginx: npm:shop to compose:api (GET api/x)',
      'w/src/main.ts:4  Angular HttpClient through the dev proxy: npm:shop to compose:api (GET api/x)',
    ]);
    expect(problems(workspace({ '/w/src/main.ts': 'export {};\n' }))).toEqual([]);
  });

  it('DRIFT-307 a relative .json that nothing forwards is configuration read at run time', () => {
    expect(
      problems(
        workspace({
          '/w/src/main.ts': lines(
            "import { HttpClient } from '@angular/common/http';",
            "export const f = (http: HttpClient) => http.get('/assets/config.json?v=2');",
          ),
        }),
      ),
    ).toEqual([
      'w/src/main.ts:2  The app reads `/assets/config.json` from its own server at run time, which drift does not read, so the addresses it holds are not checked.',
    ]);
  });
});

describe('nginx', () => {
  it('DRIFT-308 directives keep their file and line; quotes, comments and ${} are words', () => {
    const tree = parseNginx(
      lines(
        '# top',
        'http {',
        '  set $a "x y"; # tail',
        '  server { listen 80; }',
        '  return 200 ${B};',
        '}',
      ),
      '/w/n.conf',
    );
    expect(tree).toEqual([
      {
        name: 'http',
        args: [],
        file: '/w/n.conf',
        line: 2,
        block: [
          { name: 'set', args: ['$a', 'x y'], file: '/w/n.conf', line: 3, block: null },
          {
            name: 'server',
            args: [],
            file: '/w/n.conf',
            line: 4,
            block: [{ name: 'listen', args: ['80'], file: '/w/n.conf', line: 4, block: null }],
          },
          { name: 'return', args: ['200', '${B}'], file: '/w/n.conf', line: 5, block: null },
        ],
      },
    ]);
  });

  it('DRIFT-308 templates are filled in only with variables the container defines', () => {
    expect(envsubst('${A} $A $B ${B} $host', new Map([['A', 'x']]))).toBe('x x $B ${B} $host');
  });

  it('DRIFT-308 the image nginx config: its own nginx.conf, includes, templates and the ENVSUBST settings', () => {
    const found = factLines({
      '/w/compose.yaml': yaml(
        'services:',
        '  edge:',
        '    build: .',
        '    environment:',
        '      UP: http://api:9000',
        '      NGINX_ENVSUBST_TEMPLATE_SUFFIX: .tpl',
        '  api:',
        '    image: api',
      ),
      '/w/Dockerfile': lines(
        'FROM nginx AS base',
        'COPY build-only.conf /etc/nginx/conf.d/',
        'FROM nginx',
        'ENV OTHER=http://other.example.com',
        'COPY nginx.conf /etc/nginx/nginx.conf',
        'COPY sites /etc/nginx/sites/',
        'COPY a.conf.tpl b.conf.template /etc/nginx/templates/',
      ),
      '/w/nginx.conf': lines('http {', '  include sites/*.conf;', '  include conf.d/*.conf;', '}'),
      '/w/sites/one.conf': 'server { location / { proxy_pass $UP_FROM_ENV; } }\n',
      '/w/a.conf.tpl':
        'server { location /a { proxy_pass ${UP}; } location /b { proxy_pass ${OTHER}; } }\n',
      '/w/b.conf.template': 'server { location /c { proxy_pass http://ignored; } }\n',
      '/w/build-only.conf': 'server { location /d { proxy_pass http://ignored; } }\n',
    });
    expect(only(found, 'nginx proxy_pass')).toEqual([
      'w/a.conf.tpl:1  nginx proxy_pass: compose:edge to compose:api (/a=http://api:9000)',
      'w/a.conf.tpl:1  nginx proxy_pass: compose:edge to host other.example.com (/b=http://other.example.com)',
    ]);
    expect(
      problems({
        '/w/compose.yaml': yaml('services:', '  edge:', '    build: .'),
        '/w/Dockerfile': lines('FROM nginx', 'COPY nginx.conf /etc/nginx/'),
        '/w/nginx.conf': 'http { server { location / { proxy_pass http://$up; } } }\n',
      }),
    ).toEqual([
      'w/nginx.conf:1  `$up` has no value drift can read, so where this proxy_pass sends calls is not checked.',
    ]);
  });

  it('DRIFT-309 nginx picks a location as nginx does: exact, ^~, regular expressions, longest prefix', () => {
    const config = nginxConfig(['/etc/nginx/conf.d/a.conf'], () => ({
      file: '/w/a.conf',
      text: lines(
        'upstream pool { server one:1 weight=2; server two:2; }',
        'server {',
        '  set $up http://set:3;',
        '  location = /exact { proxy_pass http://exact; }',
        '  location ^~ /static/ { proxy_pass http://static; }',
        '  location ~* \\.PNG$ { proxy_pass http://images; }',
        '  location /api/ {',
        '    location /api/admin/ { proxy_pass http://admin; }',
        '    if ($x) { proxy_pass http://pool/v1; }',
        '  }',
        '  location / { proxy_pass $up; }',
        '}',
      ),
    }));
    const server = config.servers[0];
    if (server === undefined) throw new Error('no server');
    const where = (path: string): string[] | string => {
      const location = selectLocation(server.locations, path);
      if (location === null) return 'none';
      const targets = proxyTargets(location, server, config.upstreams);
      return 'urls' in targets ? targets.urls : targets.unknown;
    };
    expect(where('/exact')).toEqual(['http://exact']);
    expect(where('/static/a.png')).toEqual(['http://static']);
    expect(where('/img/a.png')).toEqual(['http://images']);
    expect(where('/api/admin/x')).toEqual(['http://admin']);
    expect(where('/api/x.png')).toEqual(['http://images']);
    expect(where('/api/x')).toEqual(['http://one:1/v1', 'http://two:2/v1']);
    expect(where('/other')).toEqual(['http://set:3']);
  });
});

describe('the parsers', () => {
  it('DRIFT-311 jsonc-parser and typescript are pinned, unpatched, and in the notices with their licences', () => {
    const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
    const lock = JSON.parse(read('package-lock.json')) as {
      packages: Record<string, { version: string; license?: string; dev?: boolean }>;
    };
    const notices = read('THIRD_PARTY_NOTICES.md');
    for (const [name, licence] of [
      ['jsonc-parser', 'MIT'],
      ['typescript', 'Apache-2.0'],
    ] as const) {
      const pinned = pkg.dependencies[name] ?? '';
      expect(pinned, name).toMatch(/^\d+\.\d+\.\d+$/);
      const installed = lock.packages[`node_modules/${name}`];
      expect(installed?.version, name).toBe(pinned);
      expect(installed?.license, name).toBe(licence);
      expect(installed?.dev, name).toBeUndefined();
      expect(notices, name).toContain(`\`${name}\` ${pinned}`);
    }
    expect(notices).toContain('## Apache License 2.0');
  });
});
