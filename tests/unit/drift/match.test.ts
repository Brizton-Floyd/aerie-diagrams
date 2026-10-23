// Matching and lifting (docs/spec/drift.md, section 5; DRIFT-403 to DRIFT-410): which code each
// element stands for, and where each piece of code runs.
import { describe, expect, it } from 'vitest';
import type { Drift } from '../../../src/drift/index.ts';
import { driftOf, keys } from './drift.ts';
import { bootApp, compose, javaClass, maven } from './projects.ts';

/** The texts of what is confirmed about elements. */
function stands(drift: Drift): string[] {
  return drift.confirmed.flatMap((each) => ('element' in each.subject ? [each.text] : []));
}

function notChecked(drift: Drift): string[] {
  return drift.notChecked.map((each) => `${each.reason}: ${each.text}`);
}

const SHOP = compose(
  'services:',
  '  web:',
  '    image: shop/web',
  '    environment:',
  '      API_URL: http://orders-api:3000',
  '  orders-api:',
  '    image: shop/orders',
);

describe('matching', () => {
  it('DRIFT-403 a code line stands for the units the code has, and a unit it lacks is missing', () => {
    const drift = driftOf(
      SHOP,
      'model m: M',
      'web: Web',
      '  code compose:web',
      'orders: Orders',
      '  code compose:orders-api compose:billing',
      'web calls orders',
    );
    expect(stands(drift)).toEqual([
      'Web stands for `compose:web`, which the code has.',
      'Orders stands for `compose:orders-api`, which the code has.',
    ]);
    expect(keys(drift)).toEqual(['drift missing-code:orders:compose:billing']);
  });

  it('DRIFT-404 a missing unit was renamed to one no element names that shares a word or is within two edits', () => {
    const renamed = (unit: string): string[] =>
      keys(
        driftOf(
          SHOP,
          'model m: M',
          'web: Web',
          '  code compose:web',
          'orders: Orders',
          `  code ${unit}`,
          'web calls orders',
        ),
      );
    expect(renamed('compose:orders')).toEqual([
      'drift renamed-code:orders:compose:orders>compose:orders-api',
    ]);
    expect(renamed('compose:orders-apl')).toEqual([
      'drift renamed-code:orders:compose:orders-apl>compose:orders-api',
    ]);
    // A common word is not enough: the unit the web names is then undrawn, by two techniques.
    expect(renamed('compose:billing-api')).toEqual([
      'drift missing-code:orders:compose:billing-api',
      'drift undrawn-code:compose:orders-api',
    ]);
    // With two equally close units there is no telling.
    const two = compose(
      'services:',
      '  orders-east:',
      '    image: a',
      '  orders-west:',
      '    image: b',
    );
    expect(keys(driftOf(two, 'model m: M', 'orders: Orders', '  code compose:orders'))).toEqual([
      'drift missing-code:orders:compose:orders',
      'likely undrawn-code:compose:orders-east',
      'likely undrawn-code:compose:orders-west',
    ]);
  });

  it('DRIFT-405 a class hint names a type, a nested type, a simple name or a package, within its module', () => {
    const files = maven(
      {
        name: 'app',
        java: {
          'a/web/Api.java': javaClass('a.web', [], 'public class Api { static class Page {} }'),
          'a/web/admin/Admin.java': javaClass('a.web.admin', [], 'public class Admin {}'),
          'a/core/Rules.java': javaClass('a.core', [], 'public class Rules {}'),
        },
      },
      { name: 'other', java: { 'z/Rules.java': javaClass('z', [], 'public class Rules {}') } },
    );
    const drift = driftOf(
      files,
      'model m: M',
      'app: App',
      '  code maven:app',
      '  web: Web',
      '    code class:a.web.*',
      '  rules: Rules',
      '    code class:Rules',
      '  page: Page',
      '    code class:a.web.Api.Page',
      '  gone: Gone',
      '    code class:a.web.Gone class:a.billing.*',
      'other: Other',
      '  code maven:other',
    );
    expect(stands(drift)).toContain('Web stands for `class:a.web.*`, which the code has.');
    expect(stands(drift)).toContain('Rules stands for `class:Rules`, which the code has.');
    expect(stands(drift)).toContain('Page stands for `class:a.web.Api.Page`, which the code has.');
    expect(keys(drift)).toEqual([
      'drift missing-code:gone:class:a.billing.*',
      'drift missing-code:gone:class:a.web.Gone',
    ]);
    const node = driftOf(
      { '/w/package.json': '{ "name": "shop-web" }' },
      'model m: M',
      'web: Web',
      '  code npm:shop-web',
      '  cart: Cart',
      '    code class:CartService',
    );
    expect(notChecked(node)).toContain(
      'typescript-classes: The `class:` hints of Cart name TypeScript, whose classes drift does not read yet, so they are not checked.',
    );
    expect(keys(node)).toEqual([]);
  });

  it('DRIFT-406 an element without a code line matches a unit or app by its normalised id or name, once', () => {
    const files = {
      ...maven(
        {
          name: 'shop-orders',
          java: { 'a/OrdersApplication.java': bootApp('a', 'OrdersApplication') },
        },
        { name: 'shop-billing' },
      ),
      ...compose('services:', '  web:', '    image: a'),
    };
    const drift = driftOf(
      files,
      'model m: M',
      'site: Site',
      '  @engineer: Web',
      'orders: Orders [module]',
      'billing: Shop billing [module]',
    );
    expect(drift.suggestions.map((each) => `${each.key}${each.used ? ' used' : ''}`)).toEqual([
      'suggestion:site:compose:web used',
      'suggestion:orders:maven:shop-orders used',
      'suggestion:billing:maven:shop-billing used',
    ]);
    expect(keys(drift)).toEqual([]);
    // The parent pom holds no code: nothing stands for it, and it is never suggested.
    expect(JSON.stringify(drift)).not.toContain('maven:root');
  });

  it('DRIFT-407 an uncertain match is a suggestion only, and its unit is not checked until a code line says so', () => {
    const files = compose(
      'services:',
      '  billing:',
      '    image: a',
      '  orders-service:',
      '    image: b',
      '  cart:',
      '    image: c',
    );
    const drift = driftOf(
      files,
      'model m: M',
      'pay: Billing',
      'bill: Billing',
      'orders: Orders',
      'basket: Basket | the cart service',
      'web: Web',
      '  code compose:web-shop',
    );
    expect(drift.suggestions.map((each) => `${each.key} ${each.detail}`)).toEqual([
      'suggestion:pay:compose:billing Its name matches, but so does another element’s, so drift does not compare it until a code line says which.',
      'suggestion:bill:compose:billing Its name matches, but so does another element’s, so drift does not compare it until a code line says which.',
      'suggestion:orders:compose:orders-service Part of its name matches, which is not enough to compare it until a code line says so.',
      'suggestion:basket:compose:cart Its tagline names it, which is not enough to compare it until a code line says so.',
    ]);
    expect(notChecked(drift).filter((each) => each.startsWith('uncertain'))).toEqual([
      'uncertain: `compose:billing` may be what Billing or Billing stands for; until a code line says so, it is not checked.',
      'uncertain: `compose:orders-service` may be what Orders stands for; until a code line says so, it is not checked.',
      'uncertain: `compose:cart` may be what Basket stands for; until a code line says so, it is not checked.',
      'uncertain: Billing may stand for `compose:billing`; until a code line says so, it is not checked.',
      'uncertain: Billing may stand for `compose:billing`; until a code line says so, it is not checked.',
      'uncertain: Orders may stand for `compose:orders-service`; until a code line says so, it is not checked.',
      'uncertain: Basket may stand for `compose:cart`; until a code line says so, it is not checked.',
    ]);
    // None of them is undrawn, and the missing service has no likely new name among them.
    expect(keys(drift)).toEqual(['drift missing-code:web:compose:web-shop']);
  });

  it('DRIFT-407 the Spring Boot app a Compose service runs, and the npm package its image copies, are suggested', () => {
    const files = {
      ...maven({
        name: 'orders-app',
        java: { 'a/Main.java': bootApp('a', 'Main') },
        config: ['server:', '  port: 8081'],
      }),
      ...compose(
        'services:',
        '  orders:',
        '    build: { context: ., dockerfile: Dockerfile }',
        '    expose: ["8081"]',
        '  web:',
        '    build: { context: ./web }',
      ),
      '/w/Dockerfile': 'FROM eclipse-temurin:21\nCOPY orders-app/src /src\n',
      '/w/web/Dockerfile': 'FROM node:24\nCOPY package.json .\n',
      '/w/web/package.json': '{ "name": "shop-web" }',
    };
    const drift = driftOf(
      files,
      'model m: M',
      'orders: Orders',
      '  code compose:orders',
      'web: Web',
      '  code compose:web',
    );
    expect(drift.suggestions.map((each) => `${each.key} ${each.detail}`)).toEqual([
      'suggestion:orders:maven:orders-app The service runs the Spring Boot app: its image is built from the module, and listens on the port the module sets.',
      'suggestion:web:npm:shop-web The service’s image is built from the package.',
    ]);
    expect(keys(drift)).toEqual([]);
  });

  it('DRIFT-408 an outside host matches the one element named by its label or whose wording names it', () => {
    const files = compose(
      'services:',
      '  api:',
      '    image: a',
      '    environment:',
      '      BANK_URL: https://api.bank.example/v2',
      '      MAPS_URL: https://tiles.maps.example/z',
      '      MAIL_URL: https://smtp.mail.example',
    );
    const drift = driftOf(
      files,
      'model m: M',
      'api: API',
      '  code compose:api',
      'bank: Bank',
      'atlas: Atlas | Tiles from `tiles.maps.example`',
      'mailer: Mail',
      'post: Mail',
      'api pays through bank',
      'api draws maps from atlas',
    );
    expect(stands(drift)).toContain(
      'Bank stands for the host `api.bank.example`, which the code has.',
    );
    expect(stands(drift)).toContain(
      'Atlas stands for the host `tiles.maps.example`, which the code has.',
    );
    expect(notChecked(drift)).toContain(
      'outside-host: API calls `smtp.mail.example`, outside the system, and no element stands for that host, which a code line cannot name.',
    );
    expect(keys(drift)).toEqual([]);
  });

  it('DRIFT-409 a line is checked at its anchors: a part without hints as its module, a person not at all', () => {
    const files = maven({
      name: 'app',
      java: {
        'a/Api.java': javaClass('a', [], 'public class Api { Store store; }'),
        'a/Store.java': javaClass('a', [], 'public class Store {}'),
      },
    });
    const drift = driftOf(
      files,
      'model m: M',
      'person: Person [person]',
      'app: App [module]',
      '  code maven:app',
      '  api: API',
      '    code class:a.Api',
      '  store: Store',
      'person uses api',
      'api reads store',
    );
    expect(notChecked(drift)).toEqual([
      'end: The line “Person uses API” is not checked: Person stands for no code drift can read.',
      'same-code: The line “API reads Store” is not checked: its ends are checked as API and App, which holds it, so drift cannot tell them apart.',
      'person: Person is a person, which code cannot show.',
      "part: Store has no `class:` hints, so it is not checked, and its lines are checked as App's.",
      'wording: The wording (names, taglines and descriptions) is not checked: wrong details are checked in phase 2.',
    ]);
  });

  it('DRIFT-410 code lifts to the closest hint, else its module, and a library to the apps that package it, each in its own app', () => {
    const files = maven(
      {
        name: 'orders',
        deps: ['shared'],
        java: {
          'o/Main.java': bootApp('o', 'Main'),
          'o/Api.java': javaClass('o', ['s.Rules'], 'public class Api { Rules rules; }'),
        },
      },
      {
        name: 'billing',
        deps: ['shared'],
        java: {
          'b/Main.java': bootApp('b', 'Main'),
          'b/Ledger.java': javaClass('b', ['s.Rules'], 'public class Ledger { Rules rules; }'),
        },
      },
      {
        name: 'shared',
        java: {
          's/Rules.java': javaClass('s', [], 'public class Rules { Money money; }'),
          's/Money.java': javaClass('s', [], 'public class Money {}'),
        },
      },
    );
    const drift = driftOf(
      files,
      'model m: M',
      'orders: Orders [module]',
      '  code maven:orders maven:shared',
      '  api: API',
      '    code class:o.Api',
      '  rules: Rules',
      '    code class:s.Rules',
      'billing: Billing [module]',
      '  code maven:billing',
      'api applies rules',
      'orders depends on billing [code]',
    );
    // `Rules` is the part's in orders; billing's `Ledger` uses its own copy of the shared library,
    // which no element of billing stands for, so it lifts to billing itself: nothing crosses.
    expect(keys(drift)).toEqual([
      'drift missing-dependency:orders>billing',
      'drift undrawn-dependency:billing>orders',
    ]);
  });
});
