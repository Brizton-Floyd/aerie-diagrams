import { describe, expect, it } from 'vitest';
import {
  defaultPicture,
  elementViews,
  findElements,
  followElement,
  locateElement,
  play,
  switchAudience,
  switchView,
} from '../../../src/model/index.ts';
import { semanticsOf } from './helpers.ts';

const MODEL = semanticsOf(`model shop: Shop

audiences plain "Plain", technical "Technical" (code)

shop: Corner shop [system]
  web: Storefront [service]
    @technical: Web client | Browser app
    code npm:shop-web
    form: Order form [module]
  api: Orders [service]
    @technical: Orders API
    code compose:orders
outside: Payment provider [external]
unused: Undrawn system [system]

web sends orders to api

view big: Big picture
  show shop
view services: Services
  show shop +1
view payments: Payments
  show outside

scenario order: Place an order
  web sends an order to api
`);

const start = defaultPicture(MODEL);

const ids = (query: string): string[] =>
  findElements(MODEL, 'plain', query).map((match) => match.id);

describe('finding model elements', () => {
  it('INT-1001 matches all audience names, ids, tags and code references without changing wording', () => {
    expect(ids('WEB CLIENT')).toEqual(['web']);
    expect(ids('npm:shop-web')).toEqual(['web']);
    expect(ids('compose:orders')).toEqual(['api']);
    expect(ids('service')).toEqual(['web', 'api']);
    expect(ids('form')).toEqual(['form']);
    expect(ids('shop storefront')).toEqual(['web', 'form']);
    expect(findElements(MODEL, 'plain', 'web client')[0]).toMatchObject({
      id: 'web',
      name: 'Storefront',
      path: 'Corner shop',
      names: ['Web client'],
      views: ['big', 'services'],
    });
    expect(findElements(MODEL, 'plain', 'form')[0]?.path).toBe('Corner shop / Storefront');
    expect(findElements(MODEL, 'technical', 'storefront')[0]?.name).toBe('Web client');
    expect(ids('no matching element')).toEqual([]);
    expect(ids('  ')).toEqual(MODEL.model.elements.map((element) => element.id));
  });

  it('INT-1011 lists only views able to reveal the exact element, including an implicit view', () => {
    expect(elementViews(MODEL, 'form')).toEqual(['big', 'services']);
    expect(elementViews(MODEL, 'outside')).toEqual(['payments']);
    expect(elementViews(MODEL, 'unused')).toEqual([]);
    expect(elementViews(MODEL, 'unknown')).toEqual([]);
    expect(elementViews(semanticsOf('app: App\n  child: Child\n'), 'child')).toEqual(['overview']);
  });

  it('INT-1011 reveals a followed element while preserving audience and ordinary view-switch behavior', () => {
    const selected = locateElement(MODEL, switchAudience(MODEL, start, 'technical'), 'form');
    const followed = followElement(MODEL, selected, 'form', 'services');
    expect(followed).toMatchObject({
      view: 'services',
      audience: 'technical',
      activity: { kind: 'selected', element: 'form' },
    });
    expect(MODEL.drawn(followed.view, followed.zoom).has('form')).toBe(true);
    expect(switchView(MODEL, selected, 'services').activity).toEqual({ kind: 'reading' });
    expect(followElement(MODEL, selected, 'form', 'payments')).toBe(selected);
    expect(followElement(MODEL, selected, 'missing', 'services')).toBe(selected);
  });

  it('INT-1003 reveals in the current eligible view or the first eligible view, ending playback', () => {
    const other = switchView(MODEL, start, 'payments');
    const found = locateElement(MODEL, other, 'form');
    expect(found).toMatchObject({ view: 'big', activity: { kind: 'selected', element: 'form' } });
    expect(MODEL.drawn('big', found.zoom).has('form')).toBe(true);
    const here = locateElement(MODEL, switchView(MODEL, start, 'services'), 'api');
    expect(here.view).toBe('services');
    expect(locateElement(MODEL, play(MODEL, start, 'order'), 'web').activity).toEqual({
      kind: 'selected',
      element: 'web',
    });
    expect(locateElement(MODEL, other, 'unused')).toBe(other);
    expect(locateElement(MODEL, other, 'missing')).toBe(other);
  });
});
