// The side panel (docs/spec/interaction.md, INT-204 and INT-205; docs/spec/look.md, LOOK-804): with
// nothing selected it describes the view; with an element selected it explains that element for the
// current audience and lists its relationships as sentences whose names are links.
import type { Id } from '../lines/index.ts';
import { proseFor, type Picture, type Semantics } from '../model/index.ts';
import { el, icon, scenarioTitle, toMarkup } from '../render/index.ts';
import { h, prose } from './dom.ts';
import { layerContent, layersOf, modelAbout } from './peek.ts';

/** What the panel's links and buttons do. */
export interface PanelActions {
  /** Reveals and selects an element (MODEL-207). */
  select(id: Id): void;
  /** Opens or closes a container in place (INT-302). */
  toggle(id: Id): void;
  /** Plays a scenario. */
  play(scenario: Id): void;
  overview(scenario: Id): void;
  /** Presents a walkthrough: the cover's tour (INT-204). */
  present(walkthrough: Id): void;
  /** INT-102: words the whole diagram for an audience, or back to the plain wording. */
  readAt(audience: Id): void;
  /** INT-207: how many "More technical" layers the reader has opened, kept for the next one. */
  revealed(count: number): void;
}

/** INT-204: the short note on how to read a view. */
export const READ_IT =
  'Click a box to see what it does and what it talks to. Boxes with a + hold more inside: press ' +
  'it, or double-click the box, to open it right here. Rest the pointer on a box for a quick look.';

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
            h('span', { class: 'play-title' }, [scenarioTitle(semantics, id, audience)]),
            h('span', { class: 'play-count' }, [
              `${String(semantics.scenario(id).steps.length)} steps`,
            ]),
          ],
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'tool flow-overview',
            'aria-label': `Show flow overview of ${scenarioTitle(semantics, id, audience)}`,
            onclick: () => {
              actions.overview(id);
            },
          },
          ['Show flow overview'],
        ),
      ]),
    ),
  );
}

const plural = (count: number, one: string, many: string): string =>
  `${String(count)} ${count === 1 ? one : many}`;

/**
 * INT-204: the panel with nothing selected is the model's cover (its title, what it is,
 * how big it is, and the tour), then the view, how to read it, and its scenarios.
 */
export function viewPanel(semantics: Semantics, picture: Picture, actions: PanelActions): Node[] {
  const { audience } = picture;
  const { model } = semantics;
  const about = semantics.scene(semantics.drawing(picture.view, picture.zoom), audience).about;
  const lead = modelAbout(semantics, audience);
  const tour = model.walkthroughs[0];
  const stats = [
    plural(model.elements.length, 'part', 'parts'),
    plural(model.views.length, 'view', 'views'),
    model.scenarios.length === 0 ? null : plural(model.scenarios.length, 'scenario', 'scenarios'),
  ].filter((each) => each !== null);
  const out: Node[] = [
    h('header', { class: 'cover' }, [
      h('p', { class: 'kicker' }, ['Architecture']),
      h('h1', { tabindex: -1, class: 'cover-title' }, [
        semantics.title(audience) ?? model.id ?? 'Untitled',
      ]),
      ...paragraphs(lead, 'cover-lead'),
      h(
        'p',
        { class: 'cover-stats' },
        stats.map((each) => h('span', {}, [each])),
      ),
      tour === undefined
        ? null
        : h(
            'button',
            {
              type: 'button',
              class: 'cta',
              'data-present': tour.id,
              onclick: () => {
                actions.present(tour.id);
              },
            },
            [
              h('span', { class: 'play', 'aria-hidden': 'true' }),
              h('span', {}, ['Take the tour']),
              h('span', { class: 'cta-count' }, [
                plural(semantics.walkPictures(tour.id).length, 'step', 'steps'),
              ]),
            ],
          ),
    ]),
    h('section', { class: 'this-view' }, [
      h('h2', {}, ['This view']),
      h('p', { class: 'view-title' }, [semantics.viewTitle(picture.view, audience)]),
      ...paragraphs(about, 'lead'),
    ]),
    section('How to read it', [h('p', {}, [READ_IT])]),
  ];
  const scenarios = model.scenarios.map((each) => each.id);
  if (scenarios.length > 0) {
    out.push(section('Watch it work', [scenarioButtons(semantics, scenarios, audience, actions)]));
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
  revealed = 0,
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
  // 3. INT-207: plain first, more on demand. Each press of "More technical" uncovers the next
  // audience's wording, showing only what changes; the page remembers how far the reader went and
  // opens the next element as far. The last layer offers to word the whole diagram that way.
  out.push(moreTechnical(semantics, picture, id, revealed, actions));
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
              h('h3', {}, ['Also connected, not drawn in this view']),
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
      section(`Inside (${String(children.length)})`, [
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
          [isOpen ? 'Close it' : 'Open it here'],
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
    out.push(section('Takes part in', [scenarioButtons(semantics, scenarios, audience, actions)]));
  }
  return out;
}

/** INT-207: the "More technical" disclosure of an element, opened `revealed` layers deep. */
function moreTechnical(
  semantics: Semantics,
  picture: Picture,
  id: Id,
  revealed: number,
  actions: PanelActions,
): HTMLElement {
  const { audience } = picture;
  const plain = semantics.model.defaultAudience;
  const layers = layersOf(semantics, id, audience);
  const box = h('section', { class: 'deeper' });
  const blocks = layers.map((layer) => layerContent(layer));
  let shown = Math.min(revealed, layers.length);
  const more = h('button', { type: 'button', class: 'more', 'aria-expanded': 'false' });
  const whole = h('button', { type: 'button', class: 'whole' });
  const fewer = h('button', { type: 'button', class: 'fewer' }, ['Less']);
  const update = (animate: boolean): void => {
    blocks.forEach((block, at) => {
      block.hidden = at >= shown;
      block.classList.toggle('entering', animate && at === shown - 1);
    });
    const next = layers[shown];
    more.hidden = next === undefined;
    more.setAttribute('aria-expanded', shown > 0 ? 'true' : 'false');
    more.replaceChildren(
      h('span', { class: 'chev', 'aria-hidden': 'true' }),
      h('span', {}, [shown === 0 ? 'More technical' : 'Even more technical']),
      next === undefined ? '' : h('span', { class: 'more-who' }, [`${next.who} wording`]),
    );
    fewer.hidden = shown === 0;
    const last = layers[shown - 1];
    whole.hidden = last === undefined;
    if (last !== undefined) whole.textContent = `Word the whole diagram for ${last.who}`;
  };
  more.addEventListener('click', () => {
    shown = Math.min(shown + 1, layers.length);
    actions.revealed(shown);
    update(true);
  });
  fewer.addEventListener('click', () => {
    shown = 0;
    actions.revealed(0);
    update(false);
  });
  whole.addEventListener('click', () => {
    const last = layers[shown - 1];
    if (last !== undefined) actions.readAt(last.audience);
  });
  update(false);
  if (layers.length === 0) {
    // Read deeper than the plain wording, the panel offers the way back instead.
    if (audience === plain) return h('span', { hidden: true });
    box.append(
      h('p', { class: 'deeper-note' }, [
        `Worded for ${semantics.audience(audience).name}. `,
        h(
          'button',
          {
            type: 'button',
            class: 'whole',
            onclick: () => {
              actions.readAt(plain);
            },
          },
          ['Back to the plain wording'],
        ),
      ]),
    );
    return box;
  }
  box.append(...blocks, h('div', { class: 'deeper-actions' }, [more, whole, fewer]));
  return box;
}
