// The Docker Compose extractor, rule by rule (docs/spec/drift.md, "Docker Compose", DRIFT-101 to
// DRIFT-113). The fixture projects (fixtures.test.ts) hold the same rules on whole projects.
import { describe, expect, it } from 'vitest';
import { readDockerfile } from '../../../src/extract/compose/dockerfile.ts';
import { readEnvFile } from '../../../src/extract/compose/dotenv.ts';
import { HOST_KEY, hideSecrets, hostsIn } from '../../../src/extract/compose/hosts.ts';
import { interpolate } from '../../../src/extract/compose/interpolate.ts';
import { folderProjectName } from '../../../src/extract/compose/load.ts';
import { shortMount, shortPort } from '../../../src/extract/compose/service.ts';
import { extractFrom, factLines, yaml } from './memory.ts';

const vars = new Map([
  ['SET', 'value'],
  ['EMPTY', ''],
  ['HOST', 'db'],
]);

describe('services and the project', () => {
  it('DRIFT-101 each service is a compose code unit, and the project takes its last name', () => {
    expect(
      factLines(
        {
          '/w/a.yaml': yaml('name: first', 'services:', '  web:', '    image: nginx'),
          '/w/b.yaml': yaml('name: ${PROJECT:-second}', 'services:', '  api:', '    image: api'),
        },
        'compose a.yaml',
        'compose b.yaml',
      ),
    ).toEqual([
      'w/a.yaml:3  Compose service: compose:web',
      'w/a.yaml:4  Compose image: compose:web runs nginx',
      'w/b.yaml:1  Compose project: second',
      'w/b.yaml:3  Compose service: compose:api',
      'w/b.yaml:4  Compose image: compose:api runs api',
    ]);
  });

  it('DRIFT-101 a project with no name is named from its folder as Compose writes it', () => {
    expect(folderProjectName('/w/My Shop.App')).toBe('myshopapp');
    expect(folderProjectName('/w/_shop-2_x')).toBe('shop-2_x');
    expect(folderProjectName('/w/lotto-options-core')).toBe('lotto-options-core');
  });
});

describe('interpolation', () => {
  it.each([
    ['$SET and ${SET}', 'value and value'],
    ['${UNSET:-default} ${EMPTY:-default} ${SET:-default}', 'default default value'],
    ['${UNSET-default} [${EMPTY-default}]', 'default []'],
    ['${SET:+alt} [${EMPTY:+alt}] ${EMPTY+alt} [${UNSET+alt}]', 'alt [] alt []'],
    ['${UNSET:-${ALSO:-${SET}}}', 'value'],
    ['http://${HOST}:5432', 'http://db:5432'],
    ['$$SET $${SET} $$', '$SET ${SET} $'],
    ['$1 ${1} ${} $', '$1 ${1} ${} $'],
    ['${SET:?needed} ${EMPTY?needed}', 'value '],
  ])('DRIFT-102 %s', (text, expected) => {
    expect(interpolate(text, vars).text).toBe(expected);
  });

  it('DRIFT-102 a variable with no value and no default reads as empty and is reported once', () => {
    expect(interpolate('${A}:$A:${B:?x}:${C:-c}:${EMPTY:?x}', vars)).toEqual({
      text: ':::c:',
      unset: ['A', 'B', 'EMPTY'],
    });
    const found = extractFrom({
      '/w/compose.yaml': yaml(
        'services:',
        '  api:',
        '    image: shop/api:${TAG}',
        '    environment:',
        '      DB: ${TAG}',
      ),
    });
    expect(
      found.problems.map((each) => [each.id, each.level, each.at?.line, each.message]),
    ).toEqual([
      [
        'unset-variable',
        'warning',
        3,
        '`TAG` has no value here or in the `.env` file and no default, so it reads as empty: the value it sets is not checked.',
      ],
    ]);
  });

  it('DRIFT-102 keys are never interpolated, and the environment drift runs in is never read', () => {
    process.env['AERIE_TEST_HOST'] = 'db';
    const lines = factLines({
      '/w/compose.yaml': yaml(
        'services:',
        '  api:',
        '    environment:',
        '      ${KEY}: http://db:1',
        '      FROM_SHELL: http://${AERIE_TEST_HOST}:5432',
        '  db:',
        '    image: postgres',
      ),
    });
    delete process.env['AERIE_TEST_HOST'];
    expect(lines.filter((line) => line.includes('environment'))).toEqual([
      'w/compose.yaml:4  Compose environment URL: compose:api to compose:db (${KEY}=http://db:1)',
    ]);
  });
});

describe('the .env format', () => {
  const read = (text: string, raw = false): [string, string | null][] =>
    readEnvFile(text, new Map([['OUTER', 'o']]), raw).entries.map((each) => [
      each.name,
      each.value,
    ]);

  it.each([
    ['VAR=VAL', 'VAL'],
    ['VAR="VAL"', 'VAL'],
    ["VAR='VAL'", 'VAL'],
    ['VAR=VAL # comment', 'VAL'],
    ['VAR=VAL# not a comment', 'VAL# not a comment'],
    ['VAR="VAL # not a comment"', 'VAL # not a comment'],
    ['VAR="VAL" # comment', 'VAL'],
    ["VAR='$OTHER'", '$OTHER'],
    ["VAR='${OTHER}'", '${OTHER}'],
    ["VAR='Let\\'s go!'", "Let's go!"],
    ['VAR="{\\"hello\\": \\"json\\"}"', '{"hello": "json"}'],
    ['VAR="some\\tvalue"', 'some\tvalue'],
    ["VAR='some\\tvalue'", 'some\\tvalue'],
    ['VAR=some\\tvalue', 'some\\tvalue'],
    ['VAR=', ''],
    ['VAR', null],
    ['export VAR=VAL', 'VAL'],
    ['VAR=${OUTER}-$OUTER', 'o-o'],
    ['VAR="$(rm -rf /)"', '$(rm -rf /)'],
  ])('DRIFT-103 %s', (line, value) => {
    expect(read(line)).toEqual([['VAR', value]]);
  });

  it('DRIFT-103 comments, blank lines, values over several lines, earlier lines and raw files', () => {
    expect(
      read(['# a comment', '', 'A=1', 'B="two', 'lines"', 'C=${A}${B}', "D='${A}'"].join('\n')),
    ).toEqual([
      ['A', '1'],
      ['B', 'two\nlines'],
      ['C', '1two\nlines'],
      ['D', '${A}'],
    ]);
    expect(readEnvFile('A=1\nB=x\n').entries.map((each) => each.line)).toEqual([1, 2]);
    expect(read('VAR="${OUTER}" # kept as written', true)).toEqual([
      ['VAR', '"${OUTER}" # kept as written'],
    ]);
  });
});

describe('merging', () => {
  it.each([
    ['3000', { hostIp: null, published: null, target: '3000', protocol: 'tcp' }],
    ['8000:8000', { hostIp: null, published: '8000', target: '8000', protocol: 'tcp' }],
    [
      '9090-9091:8080-8081',
      { hostIp: null, published: '9090-9091', target: '8080-8081', protocol: 'tcp' },
    ],
    [
      '127.0.0.1:8001:8001',
      { hostIp: '127.0.0.1', published: '8001', target: '8001', protocol: 'tcp' },
    ],
    ['::1:6000:6000', { hostIp: '::1', published: '6000', target: '6000', protocol: 'tcp' }],
    ['[::1]:6001:6001', { hostIp: '::1', published: '6001', target: '6001', protocol: 'tcp' }],
    ['6060:6060/udp', { hostIp: null, published: '6060', target: '6060', protocol: 'udp' }],
  ])('DRIFT-104 port %s', (spec, port) => {
    expect(shortPort(spec)).toEqual(port);
  });

  it.each([
    ['/var/lib/data', { type: 'volume', source: null, target: '/var/lib/data' }],
    ['data:/var/lib/data', { type: 'volume', source: 'data', target: '/var/lib/data' }],
    ['./site:/srv:ro', { type: 'bind', source: './site', target: '/srv' }],
    ['/etc/tz:/etc/tz', { type: 'bind', source: '/etc/tz', target: '/etc/tz' }],
    ['~/.m2:/root/.m2', { type: 'bind', source: '~/.m2', target: '/root/.m2' }],
  ])('DRIFT-104 volume %s', (spec, mount) => {
    expect(shortMount(spec)).toEqual(mount);
  });

  it('DRIFT-104 later files merge mappings key by key, replace scalars, and keep ports and volumes unique', () => {
    const lines = factLines(
      {
        '/w/a.yaml': yaml(
          'services:',
          '  api:',
          '    image: shop/api:1',
          '    environment:',
          '      - ONE=http://db:1',
          '      - TWO=http://db:2',
          '    ports: ["8080:80", "9000"]',
          '    volumes: ["data:/data", "./logs:/logs"]',
          '    profiles: [full]',
          '  db:',
          '    image: postgres',
        ),
        '/w/b.yaml': yaml(
          'services:',
          '  api:',
          '    image: shop/api:2',
          '    environment:',
          '      TWO: http://db:22',
          '      THREE: !reset null',
          '    ports: ["8080:80", "9001"]',
          '    volumes: ["other:/data"]',
          '    profiles: [full, debug]',
        ),
      },
      'compose a.yaml',
      'compose b.yaml',
    );
    expect(
      lines.filter((line) => line.includes('compose:api') && !line.includes('service:')),
    ).toEqual([
      'w/a.yaml:5  Compose environment URL: compose:api to compose:db (ONE=http://db:1)',
      'w/a.yaml:7  Compose port: compose:api publishes 9000/tcp on a free port',
      'w/a.yaml:8  Compose volume: compose:api mounts folder w/logs at /logs',
      'w/b.yaml:3  Compose image: compose:api runs shop/api:2',
      'w/b.yaml:5  Compose environment URL: compose:api to compose:db (TWO=http://db:22)',
      'w/b.yaml:7  Compose port: compose:api publishes 80/tcp on 8080',
      'w/b.yaml:7  Compose port: compose:api publishes 9001/tcp on a free port',
      'w/b.yaml:8  Compose volume: compose:api mounts volume other at /data',
      'w/b.yaml:9  Compose profile: compose:api is in profile debug',
      'w/b.yaml:9  Compose profile: compose:api is in profile full',
    ]);
  });

  it('DRIFT-104 !reset removes an attribute or one variable, and !override replaces an attribute', () => {
    const lines = factLines(
      {
        '/w/a.yaml': yaml(
          'services:',
          '  api:',
          '    environment:',
          '      KEEP: http://db:1',
          '      DROP: http://db:2',
          '    ports: ["80"]',
          '    depends_on: [db]',
          '  db:',
          '    image: postgres',
        ),
        '/w/b.yaml': yaml(
          'services:',
          '  api:',
          '    environment:',
          '      DROP: !reset',
          '    ports: !override ["81"]',
          '    depends_on: !reset []',
        ),
      },
      'compose a.yaml',
      'compose b.yaml',
    );
    expect(
      lines.filter((line) => line.includes('compose:api') && !line.includes('service:')),
    ).toEqual([
      'w/a.yaml:4  Compose environment URL: compose:api to compose:db (KEEP=http://db:1)',
      'w/b.yaml:5  Compose port: compose:api publishes 81/tcp on a free port',
    ]);
  });
});

describe('extends and include', () => {
  it('DRIFT-105 extends takes from another file, with that file’s folder for its paths', () => {
    const lines = factLines(
      {
        '/w/compose.yaml': yaml(
          'services:',
          '  api:',
          '    extends:',
          '      file: base/common.yaml',
          '      service: java',
          '    image: shop/api',
        ),
        '/w/base/common.yaml': yaml(
          'services:',
          '  java:',
          '    volumes: ["./certs:/certs"]',
          '    extends: { service: root }',
          '  root:',
          '    profiles: [jvm]',
        ),
      },
      'compose compose.yaml',
    );
    expect(lines).toEqual([
      'w/base/common.yaml:3  Compose volume: compose:api mounts folder w/base/certs at /certs',
      'w/base/common.yaml:6  Compose profile: compose:api is in profile jvm',
      'w/compose.yaml:1  Compose project folder: w',
      'w/compose.yaml:2  Compose service: compose:api',
      'w/compose.yaml:6  Compose image: compose:api runs shop/api',
    ]);
  });

  it('DRIFT-105 an unknown extends service, a loop, a missing file and a doubly declared service are warnings', () => {
    const found = extractFrom(
      {
        '/w/compose.yaml': yaml(
          'include:',
          '  - path: [inc/compose.yaml]',
          '    project_directory: inc',
          '  - gone.yaml',
          'services:',
          '  a:',
          '    extends: nowhere',
          '  b:',
          '    extends: c',
          '  c:',
          '    extends: b',
          '  d:',
          '    extends: { file: missing.yaml, service: x }',
        ),
        '/w/inc/compose.yaml': yaml(
          'services:',
          '  a:',
          '    image: other',
          '  e:',
          '    image: e:${TAG}',
        ),
        '/w/inc/.env': 'TAG=7\n',
      },
      'compose compose.yaml',
    );
    expect(found.problems.map((each) => `${String(each.at?.line)} ${each.message}`)).toEqual([
      '7 `extends` names the service `nowhere`, which this file does not have, so nothing is taken from it.',
      '11 Service `c` extends itself through `extends`, so nothing is taken from it.',
      '9 Service `b` extends itself through `extends`, so nothing is taken from it.',
      '13 The Compose file named by `extends` `/w/missing.yaml` does not exist, so what it holds is not checked.',
      '2 An included Compose file declares service `a` again; the first one is kept.',
      '4 The included Compose file `/w/gone.yaml` does not exist, so what it holds is not checked.',
    ]);
    expect(
      found.facts.map((fact) => (fact.kind === 'image' ? fact.image : null)).filter(Boolean),
    ).toEqual(['e:7']);
  });
});

describe('builds and the Dockerfile', () => {
  it('DRIFT-106 a build written as a path, or with no context, builds in the project folder', () => {
    expect(
      factLines(
        {
          '/w/compose.yaml': yaml(
            'services:',
            '  a:',
            '    build: ./a',
            '  b:',
            '    build:',
            '      target: app',
          ),
          '/w/a/Dockerfile': 'FROM scratch\n',
          '/w/Dockerfile': 'FROM scratch AS app\n',
        },
        'compose compose.yaml',
      ).filter((line) => line.includes('build context')),
    ).toEqual([
      'w/compose.yaml:3  Compose build context: compose:a builds in w/a (w/a/Dockerfile)',
      'w/compose.yaml:5  Compose build context: compose:b builds in w (w/Dockerfile, target app)',
    ]);
  });

  it('DRIFT-107 stages: global arguments, names in any case, copies by index, heredocs and URLs skipped', () => {
    const stages = readDockerfile(
      [
        'ARG BASE=node:22',
        'ARG DIR=web',
        'FROM ${BASE} AS Build',
        'ARG DIR',
        'COPY ${DIR}/package.json ./',
        'ADD https://example.com/x.tgz /tmp/',
        'COPY <<EOF /etc/x',
        'hello',
        'EOF',
        'FROM build',
        'COPY --from=0 /a /b',
        'COPY --from=BUILD /c /d',
      ].join('\n'),
      new Map([['BASE', 'node:24']]),
    );
    expect(stages.map((each) => [each.name, each.base, each.copies])).toEqual([
      ['Build', 'node:24', [{ from: null, sources: ['web/package.json'], line: 5 }]],
      [
        null,
        'build',
        [
          { from: '0', sources: ['/a'], line: 11 },
          { from: 'BUILD', sources: ['/c'], line: 12 },
        ],
      ],
    ]);
  });

  it('DRIFT-107 only the stages the target needs give sources', () => {
    const lines = factLines(
      {
        '/w/compose.yaml': yaml('services:', '  app:', '    build: { context: ., target: app }'),
        '/w/Dockerfile': [
          'FROM alpine AS unused',
          'COPY unused /u',
          'FROM alpine AS deps',
          'COPY deps /d',
          'FROM alpine AS app',
          'COPY --from=deps /d /d',
          'COPY src /src',
          'FROM app AS later',
          'COPY later /l',
        ].join('\n'),
      },
      'compose compose.yaml',
    );
    expect(lines.filter((line) => line.includes('COPY'))).toEqual([
      'w/Dockerfile:4  Dockerfile COPY: compose:app is built from w/deps (stage deps)',
      'w/Dockerfile:7  Dockerfile COPY: compose:app is built from w/src (stage app)',
    ]);
  });

  it('DRIFT-108 the image keeps the ENV and EXPOSE of its base stages, not of stages it copies from', () => {
    const stages = readDockerfile(
      ['FROM a AS one', 'ENV A=1', 'FROM one AS two', 'ENV B=${A}2', 'EXPOSE 80 $B/udp'].join('\n'),
      new Map(),
    );
    expect(stages.map((each) => [each.env, each.expose])).toEqual([
      [[{ name: 'A', value: '1', line: 2 }], []],
      [
        [{ name: 'B', value: '12', line: 4 }],
        [
          { port: '80', protocol: 'tcp', line: 5 },
          { port: '12', protocol: 'udp', line: 5 },
        ],
      ],
    ]);
  });
});

describe('the image environment', () => {
  it('DRIFT-108 the image ENV counts unless Compose gives the variable a value of its own', () => {
    const lines = factLines(
      {
        '/w/compose.yaml': yaml(
          'services:',
          '  web:',
          '    build: .',
          '    environment:',
          '      - SET=http://api:2',
          '      - LISTED',
          '  api:',
          '    image: shop/api',
        ),
        '/w/Dockerfile': [
          'FROM nginx',
          'ENV SET=http://api:1',
          'ENV LISTED=http://api:3',
          'ENV OWN=http://api:4',
        ].join('\n'),
      },
      'compose compose.yaml',
    );
    expect(lines.filter((line) => line.includes('environment'))).toEqual([
      'w/Dockerfile:3  Compose environment URL: compose:web to compose:api (LISTED=http://api:3)',
      'w/Dockerfile:4  Compose environment URL: compose:web to compose:api (OWN=http://api:4)',
      'w/compose.yaml:5  Compose environment URL: compose:web to compose:api (SET=http://api:2)',
    ]);
  });
});

describe('connections', () => {
  it('DRIFT-109 env files apply in order, environment over them, and a variable with no value unsets', () => {
    const lines = factLines(
      {
        '/w/compose.yaml': yaml(
          'services:',
          '  api:',
          '    env_file: [a.env, b.env]',
          '    environment:',
          '      - FROM_B',
          '      - FROM_A=http://db:3',
          '  db:',
          '    image: postgres',
        ),
        '/w/a.env': 'FROM_A=http://db:1\nONLY_A=http://db:4\n',
        '/w/b.env': 'FROM_A=http://db:2\nFROM_B=http://db:5\n',
      },
      'compose compose.yaml',
    );
    expect(lines.filter((line) => line.includes('environment'))).toEqual([
      'w/a.env:2  Compose environment URL: compose:api to compose:db (ONLY_A=http://db:4)',
      'w/compose.yaml:6  Compose environment URL: compose:api to compose:db (FROM_A=http://db:3)',
    ]);
  });

  it('DRIFT-109 a missing env file is a warning unless it is not required', () => {
    const found = extractFrom(
      {
        '/w/compose.yaml': yaml(
          'services:',
          '  api:',
          '    env_file:',
          '      - gone.env',
          '      - path: optional.env',
          '        required: false',
        ),
      },
      'compose compose.yaml',
    );
    expect(found.problems.map((each) => each.message)).toEqual([
      'The environment file `/w/gone.env` does not exist, so what it holds is not checked.',
    ]);
  });

  it.each([
    ['http://core:8002', [['url', 'core', true]]],
    ['https://user:pw@api.example.com/v1?x=1', [['url', 'api.example.com', false]]],
    [
      'mongodb://a:1,b:2/db',
      [
        ['url', 'a', true],
        ['url', 'b', true],
      ],
    ],
    ['jdbc:postgresql://db:5432/app', [['jdbc', 'db', true]]],
    ['jdbc:sqlserver://sql:1433;databaseName=x', [['jdbc', 'sql', true]]],
    ['jdbc:oracle:thin:@ora:1521:orcl', [['jdbc', 'ora', true]]],
    ['jdbc:oracle:thin:@//ora2:1521/svc', [['jdbc', 'ora2', true]]],
    [
      'kafka:9092,KAFKA-2:9092',
      [
        ['host', 'kafka', true],
        ['host', 'kafka-2', true],
      ],
    ],
    ['rabbit', [['host', 'rabbit', false]]],
    [
      'http://[::1]:80 then cache:6379',
      [
        ['url', '::1', true],
        ['host', 'then', false],
        ['host', 'cache', true],
      ],
    ],
    ['-Xmx512m true', [['host', 'true', false]]],
  ])('DRIFT-110 hosts in %s', (value, hosts) => {
    expect(hostsIn(value).map((each) => [each.kind, each.host, each.port])).toEqual(hosts);
  });

  it('DRIFT-110 a bare name needs a port or a variable name that holds a host', () => {
    expect(
      ['DB_HOST', 'BROKER', 'API_URL', 'KAFKA_BOOTSTRAP_SERVERS', 'UPSTREAM'].filter((key) =>
        HOST_KEY.test(key),
      ),
    ).toHaveLength(5);
    expect(
      ['SPRING_PROFILES_ACTIVE', 'WORKER_NAME', 'MODE', 'DB_PASSWORD'].filter((key) =>
        HOST_KEY.test(key),
      ),
    ).toEqual([]);
    const lines = factLines(
      {
        '/w/compose.yaml': yaml(
          'services:',
          '  api:',
          '    environment:',
          '      MODE: worker',
          '      QUEUE: worker:5672',
          '      WORKER_HOST: worker',
          '      SELF: api:8080',
          '      LOOP: http://127.0.0.1:9',
          '      OUTSIDE: outside.example.com:443',
          '  worker:',
          '    image: shop/worker',
        ),
      },
      'compose compose.yaml',
    );
    expect(lines.filter((line) => line.includes('environment'))).toEqual([
      'w/compose.yaml:5  Compose environment host name: compose:api to compose:worker (QUEUE=worker:5672)',
      'w/compose.yaml:6  Compose environment host name: compose:api to compose:worker (WORKER_HOST=worker)',
    ]);
  });

  it.each([
    ['postgres://app:s3cret@db:5432/x', 'postgres://app:***@db:5432/x'],
    ['redis://:s3cret@cache:6379', 'redis://:***@cache:6379'],
    ['http://user@host/x', 'http://user@host/x'],
    [
      'jdbc:sqlserver://sql;user=sa;password=s3cret;encrypt=true',
      'jdbc:sqlserver://sql;user=sa;password=***;encrypt=true',
    ],
    ['https://api/x?token=abc&apikey=def', 'https://api/x?token=***&apikey=***'],
  ])('DRIFT-111 %s hides its secret', (value, hidden) => {
    expect(hideSecrets(value)).toBe(hidden);
  });

  it('DRIFT-112 depends_on and links name only services of the project, and only corroborate', () => {
    const lines = factLines(
      {
        '/w/compose.yaml': yaml(
          'services:',
          '  api:',
          '    depends_on:',
          '      db: { condition: service_healthy }',
          '      ghost: { condition: service_started, required: false }',
          '    links: [db, "cache:kv", "elsewhere:x"]',
          '  db:',
          '    image: postgres',
          '  cache:',
          '    image: redis',
        ),
      },
      'compose compose.yaml',
    );
    expect(lines.filter((line) => line.includes(' to '))).toEqual([
      'w/compose.yaml:4  Compose depends_on: compose:api to compose:db',
      'w/compose.yaml:6  Compose links: compose:api to compose:cache',
      'w/compose.yaml:6  Compose links: compose:api to compose:db',
    ]);
  });
});

describe('details', () => {
  it('DRIFT-113 a healthcheck is CMD, CMD-SHELL or a string, and none when NONE or disabled', () => {
    const lines = factLines(
      {
        '/w/compose.yaml': yaml(
          'services:',
          '  a:',
          '    healthcheck: { test: ["CMD", "curl", "-f", "http://localhost/"] }',
          '  b:',
          '    healthcheck: { test: ["CMD-SHELL", "pg_isready -h db"] }',
          '  c:',
          '    healthcheck: { test: "wget -q http://other:80/" }',
          '  d:',
          '    healthcheck: { test: ["NONE"] }',
          '  e:',
          '    healthcheck: { test: "true", disable: true }',
          '  other:',
          '    image: x',
        ),
      },
      'compose compose.yaml',
    );
    expect(lines.filter((line) => line.includes('healthcheck') || line.includes(' to '))).toEqual([
      'w/compose.yaml:3  Compose healthcheck: compose:a checks itself with curl -f http://localhost/',
      'w/compose.yaml:5  Compose healthcheck: compose:b checks itself with pg_isready -h db',
      'w/compose.yaml:7  Compose healthcheck: compose:c checks itself with wget -q http://other:80/',
    ]);
  });
});
