// INT-207 and INT-208 (plain first, more on demand): the wording an element has for each audience after the
// one the page reads in, as layers a reader uncovers one at a time. The hover card on the stage
// shows them at a glance; the side panel opens them one by one ("More technical").
import type { Id } from '../lines/index.ts';
import { proseFor, type Semantics } from '../model/index.ts';
import { h, prose } from './dom.ts';
import { documentation } from './documentation.ts';

/** One audience's wording of an element, where it differs from the layer before it. */
export interface Layer {
  audience: Id;
  /** The audience's display name, such as "Engineer". */
  who: string;
  /** MODEL-105: an audience that reads code reads its wording in monospace. */
  code: boolean;
  /** The name, when it differs from the layer before. */
  name: string | null;
  /** The tagline, when it differs from the layer before. */
  tagline: string | null;
  /** The description, when it differs from the layer before. */
  about: string | null;
}

/**
 * The layers after `audience`, in declared order, each holding only what changes from the layer
 * before; an audience that words the element exactly as the one before adds no layer.
 */
export function layersOf(semantics: Semantics, id: Id, audience: Id): Layer[] {
  const all = semantics.model.audiences;
  const from = all.findIndex((each) => each.id === audience);
  const out: Layer[] = [];
  let before = {
    name: semantics.name(id, audience),
    tagline: semantics.tagline(id, audience),
    about: semantics.about(id, audience),
  };
  for (const each of all.slice(from + 1)) {
    const now = {
      name: semantics.name(id, each.id),
      tagline: semantics.tagline(id, each.id),
      about: semantics.about(id, each.id),
    };
    const layer: Layer = {
      audience: each.id,
      who: each.name,
      code: each.code,
      name: now.name === before.name ? null : now.name,
      tagline: now.tagline === before.tagline ? null : now.tagline,
      about: newPart(before.about, now.about),
    };
    if (layer.name !== null || layer.tagline !== null || layer.about !== null) out.push(layer);
    before = now;
  }
  return out;
}

/**
 * What a description says that the one before did not: nothing when it is the same, only the
 * added paragraphs when it adds to it (LANG-303), else all of it.
 */
function newPart(before: string | null, now: string | null): string | null {
  if (now === null || now === before) return null;
  if (before !== null && now.startsWith(`${before}\n\n`)) return now.slice(before.length + 2);
  return now;
}

/** The first sentence of a description, for a card too small for all of it. */
function firstSentence(text: string): string {
  const para = text.split(/\n\n+/)[0] ?? '';
  const found = /^(.+?[.!?])(\s|$)/s.exec(para);
  return (found?.[1] ?? para).replace(/\s+/g, ' ');
}

/** The hover card of an element: what it is, what it does, and how the deeper layers call it. */
export function peekContent(semantics: Semantics, id: Id, audience: Id): HTMLElement {
  const about = semantics.about(id, audience);
  const layers = layersOf(semantics, id, audience);
  return h('div', { class: 'peek-content' }, [
    h('p', { class: 'peek-kind' }, [semantics.kindLabel(id, audience)]),
    about === null ? null : h('p', { class: 'peek-about' }, prose(firstSentence(about))),
    layers.length === 0
      ? null
      : h(
          'dl',
          { class: 'peek-layers' },
          layers
            .filter((layer) => layer.name !== null || layer.tagline !== null)
            .flatMap((layer) => [
              h('dt', {}, [layer.who]),
              h('dd', { class: layer.code ? 'code' : null }, [
                [layer.name, layer.tagline].filter((part) => part !== null).join(' · '),
              ]),
            ]),
        ),
    h('p', { class: 'peek-hint' }, [
      semantics.tree.isContainer(id)
        ? 'Click to read more, double-click to open it'
        : 'Click to read more',
    ]),
  ]);
}

/** A layer's wording in the side panel: its name and tagline, then its description. */
export function layerContent(layer: Layer): HTMLElement {
  return h('div', { class: 'layer', 'data-audience': layer.audience }, [
    h('p', { class: 'layer-who' }, [`${layer.who} wording`]),
    layer.name === null ? null : h('p', { class: 'layer-name' }, [layer.name]),
    layer.tagline === null
      ? null
      : h('p', { class: layer.code ? 'layer-line code' : 'layer-line' }, [layer.tagline]),
    ...documentation(layer.about, layer.code ? 'layer-about code' : 'layer-about'),
  ]);
}

/** The model's own description for an audience (LANG-101), or null. */
export function modelAbout(semantics: Semantics, audience: Id): string | null {
  return proseFor(semantics.model.about, audience);
}
