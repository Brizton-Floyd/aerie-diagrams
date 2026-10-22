// The side panel (docs/spec/interaction.md, INT-204 and INT-205; docs/spec/look.md, LOOK-804): with
// nothing selected it describes the view; with an element selected it explains that element for the
// current audience and lists its relationships as sentences whose names are links.
import type { Id } from '../lines/index.ts';
import { proseFor, type Picture, type Semantics } from '../model/index.ts';
import { el, icon, scenarioTitle, toMarkup } from '../render/index.ts';
import { h, prose } from './dom.ts';

/** What the panel's links and buttons do. */
export interface PanelActions {
  /** Reveals and selects an element (MODEL-207). */
  select(id: Id): void;
  /** Opens or closes a container in place (INT-302). */
  toggle(id: Id): void;
  /** Plays a scenario. */
  play(scenario: Id): void;
}

/** INT-204: the short note on how to read a view. */
export const READ_IT =
  'Click any box to see what it does and how it connects. Use the round button on a box to open ' +
  'it in place. Switch who it is written for at the top; nothing moves.';

/** Description text as paragraphs. */
function paragraphs(text: string | null, className: string): HTMLElement[] {
  if (text === null) return [];
  return text.split(/\n\n+/).map((para) => h('p', { class: className }, prose(para)));
}

/** A section of the panel under a heading, separated by a rule (LOOK-804). */
function section(title: string, children: readonly Node[]): HTMLElement {
  return h('section', {}, [h('h2', {}, [title]), ...children]);
}

/** A button styled as a link that reveals and selects an element (INT-205, LOOK-804). */
function nameLink(semantics: Semantics, id: Id, audience: Id, actions: PanelActions): HTMLElement {
  return h(
    'button',
    {
      type: 'button',
      class: 'name',
      'data-select': id,
      onclick: () => {
        actions.select(id);
      },
    },
    [semantics.name(id, audience)],
  );
}

/** The scenario buttons of a list (INT-204, INT-205). */
function scenarioButtons(
  semantics: Semantics,
  ids: readonly Id[],
  audience: Id,
  actions: PanelActions,
): HTMLElement {
  return h(
    'ul',
    { class: 'plays' },
    ids.map((id) =>
      h('li', {}, [
        h(
          'button',
          {
            type: 'button',
            class: 'tool play-scenario',
            'data-play': id,
            onclick: () => {
              actions.play(id);
            },
          },
          [
            h('span', { class: 'play', 'aria-hidden': 'true' }),
            scenarioTitle(semantics, id, audience),
          ],
        ),
      ]),
    ),
  );
}

/** INT-204: the panel with nothing selected: the view, how to read it, and its scenarios. */
export function viewPanel(semantics: Semantics, picture: Picture, actions: PanelActions): Node[] {
  const { audience } = picture;
  const about = semantics.scene(semantics.drawing(picture.view, picture.zoom), audience).about;
  const out: Node[] = [
    h('p', { class: 'kicker' }, ['View']),
    h('h1', { tabindex: -1 }, [semantics.viewTitle(picture.view, audience)]),
    ...paragraphs(about, 'lead'),
    section('Read it', [h('p', {}, [READ_IT])]),
  ];
  const scenarios = semantics.model.scenarios.map((each) => each.id);
  if (scenarios.length > 0) {
    out.push(
      section('Play a scenario', [scenarioButtons(semantics, scenarios, audience, actions)]),
    );
  }
  return out;
}

/** True when `id` is the element or inside it. */
const within = (semantics: Semantics, element: Id, id: Id): boolean =>
  id === element || semantics.tree.contains(element, id);

/** One relationship as a sentence (MODEL-305): linked names, the verb phrase in italic. */
function sentence(
  semantics: Semantics,
  index: number,
  audience: Id,
  actions: PanelActions,
): HTMLElement {
  const relationship = semantics.model.relationships[index];
  if (relationship === undefined) return h('li');
  // MODEL-105: an audience that reads code reads verb phrases and descriptions in monospace.
  const code = semantics.audience(audience).code;
  return h('li', { 'data-relationship': index }, [
    h('p', { class: 'sentence' }, [
      nameLink(semantics, relationship.subject, audience, actions),
      ' ',
      h('em', { class: code ? 'code' : null }, [semantics.verb(index, audience)]),
      ' ',
      nameLink(semantics, relationship.object, audience, actions),
      '.',
    ]),
    ...paragraphs(proseFor(relationship.about, audience), code ? 'about code' : 'about'),
  ]);
}

/** The element's icon, drawn as in the diagram. */
function iconOf(semantics: Semantics, id: Id): HTMLElement {
  const holder = h('span', { class: 'icon-holder', 'aria-hidden': 'true' });
  holder.innerHTML = toMarkup(
    el('svg', { class: 'aerie', width: 22, height: 22, viewBox: '0 0 22 22' }, [
      icon(semantics.tree.icon(id), 0, 0, 22),
    ]),
  );
  return holder;
}

/** INT-205: the panel for a selected element, worded for the current audience. */
export function elementPanel(
  semantics: Semantics,
  picture: Picture,
  id: Id,
  actions: PanelActions,
): Node[] {
  const { audience } = picture;
  const code = semantics.audience(audience).code;
  const tagline = semantics.tagline(id, audience);
  // 1. The kind label, the icon and name, and the tagline.
  const out: Node[] = [
    h('p', { class: 'kicker' }, [semantics.kindLabel(id, audience)]),
    h('h1', { tabindex: -1 }, [iconOf(semantics, id), semantics.name(id, audience)]),
  ];
  if (tagline !== null) out.push(h('p', { class: code ? 'lead code' : 'lead' }, [tagline]));
  // 2. The description.
  out.push(...paragraphs(semantics.about(id, audience), code ? 'about code' : 'about'));
  // 3. The name and tagline at every level, the current one shaded.
  out.push(
    section('At every level', [
      h(
        'ul',
        { class: 'levels' },
        semantics.model.audiences.map((each) => {
          const line = semantics.tagline(id, each.id);
          return h('li', { class: each.id === audience ? 'on' : null, 'data-audience': each.id }, [
            h('span', { class: 'who' }, [each.name]),
            h('span', { class: 'what' }, [semantics.name(id, each.id)]),
            line === null ? null : h('span', { class: each.code ? 'line code' : 'line' }, [line]),
          ]);
        }),
      ),
    ]),
  );
  // 4. Its relationships, those of kinds the view draws first.
  const kinds = new Set(semantics.scope(picture.view).view.kinds);
  const drawn: HTMLElement[] = [];
  const hidden: HTMLElement[] = [];
  semantics.model.relationships.forEach((relationship, index) => {
    if (!within(semantics, id, relationship.subject) && !within(semantics, id, relationship.object))
      return;
    (kinds.has(relationship.kind) ? drawn : hidden).push(
      sentence(semantics, index, audience, actions),
    );
  });
  if (drawn.length > 0 || hidden.length > 0) {
    out.push(
      section('Connections', [
        h('ul', { class: 'sentences' }, drawn),
        ...(hidden.length === 0
          ? []
          : [
              h('h3', {}, ['Not drawn in this view']),
              h('ul', { class: 'sentences hidden-kind' }, hidden),
            ]),
      ]),
    );
  }
  // 5. A container's children, and the button that opens or closes it in place.
  const children = semantics.tree.children(id);
  if (children.length > 0) {
    const drawnSet = semantics.drawn(picture.view, picture.zoom);
    const isOpen = semantics.scope(picture.view).state(drawnSet, id) === 'open';
    out.push(
      section('Inside', [
        h(
          'ul',
          { class: 'inside' },
          children.map((child) => {
            const line = semantics.tagline(child.id, audience);
            return h('li', {}, [
              nameLink(semantics, child.id, audience, actions),
              line === null ? null : h('span', { class: code ? 'line code' : 'line' }, [line]),
            ]);
          }),
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'tool',
            'data-toggle': id,
            onclick: () => {
              actions.toggle(id);
            },
          },
          [isOpen ? 'Close in place' : 'Open in place'],
        ),
      ]),
    );
  }
  // 6. The scenarios it, or anything inside it, takes part in.
  const scenarios = semantics.model.scenarios
    .filter((scenario) =>
      scenario.steps.some(
        (step) => within(semantics, id, step.subject) || within(semantics, id, step.object),
      ),
    )
    .map((scenario) => scenario.id);
  if (scenarios.length > 0) {
    out.push(section('In scenarios', [scenarioButtons(semantics, scenarios, audience, actions)]));
  }
  return out;
}
