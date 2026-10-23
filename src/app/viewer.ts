// The viewer page (`npm run dev`; docs/spec/interaction.md): opens a bundled sample or a local .aerie
// file and lets a reader explore it in the Contour look, with the page grid of LOOK-801. A reader
// selects an element to read about it in the side panel (INT-201 to INT-206), opens containers in
// place (INT-301 to INT-304), switches the audience without moving anything (INT-101 to INT-105),
// moves the camera (INT-351 to INT-353), and does all of it from the keyboard too (INT-901 to
// INT-905). The navigation sidebar lists the views, scenarios and walkthroughs (INT-401 to INT-404),
// and the address always holds the picture as a shared link, with Back and Forward stepping between
// views and activities (INT-501 to INT-507, link.ts). A reader plays a scenario on the architecture
// or as lanes, step by step or by itself (INT-601 to INT-606, scenario.ts), started with
// `playScenario`; presenting (A9) builds on it. The split editor (editing.ts) and watch mode
// (watching.ts) give it new versions of the model.
import {
  check,
  closeContainer,
  normalisePicture,
  openContainer,
  play,
  present,
  presentStep,
  select,
  stop,
  switchAudience,
  switchView,
  wordsFor,
  Semantics,
  type Activity,
  type Picture,
} from '../model/index.ts';
import type { Id } from '../lines/index.ts';
import { CAMERA, Layouter, trailShapes } from '../layout/index.ts';
import { workerEngine } from '../layout/elk/worker.ts';
import {
  BADGE_TEXT,
  DRAWN,
  font,
  renderLanes,
  renderPicture,
  scenarioTitle,
  toMarkup,
  type Focus,
  type Theme,
} from '../render/index.ts';
import { h } from './dom.ts';
import { STALE_LINK, readFragment, writeFragment } from './link.ts';
import { KEPT_NOTICE, errorText, type Checked } from './live.ts';
import { LOGO } from './logo.ts';
import { Swap } from './motion.ts';
import { elementPanel, viewPanel, type PanelActions } from './panel.ts';
import { FIRST_SAMPLE, SAMPLES } from './samples.ts';
import { Autoplay, ScenarioPanel, captionOf, type ScenarioActions } from './scenario.ts';
import { Stage, type Arrival, type Showing } from './stage.ts';

/**
 * Every face the page draws, loaded before the page says it is ready, so no drawing is ever shown
 * in a fallback face (LOOK-101).
 */
const FACES = [
  ...Object.values(DRAWN).map((role) => font(role.face, role.size)),
  `${String(BADGE_TEXT.weight)} ${String(BADGE_TEXT.size)}px "${BADGE_TEXT.family}"`,
  '400 15px "Source Sans 3"',
];

const THEME_KEY = 'aerie.theme';
const MOTION_KEY = 'aerie.motion';

/** LOOK-802: each audience tab is this wide, so the underline moves by it. */
const TAB_WIDTH = 104;

/** LOOK-901: how long "Link copied" shows. It is words to read, not motion, so it always lasts. */
const COPIED_FOR = 1400;

/** INT-505: how long the stage says that part of a link no longer matches the diagram. */
const STALE_FOR = 6000;

/**
 * INT-506: the history entry a picture belongs to. Choosing a view, and starting or ending a
 * scenario or walkthrough, moves to another entry; every other change stays in the same one.
 */
function entry(picture: Picture): string {
  const { activity } = picture;
  if (activity.kind === 'playing') return `play ${activity.scenario}`;
  if (activity.kind === 'presenting') return `present ${activity.walkthrough}`;
  return `view ${picture.view}`;
}

/** Whether a change of picture adds a history entry or replaces the current one (INT-506). */
type HistoryMove = 'navigate' | 'replace';

function remembered(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function remember(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage may be off; the choice then lasts for this page only.
  }
}

/** A control whose own Space and Enter keys press it, so the page's shortcuts leave them alone. */
function pressable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLButtonElement ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLAnchorElement
  );
}

/** INT-004: keyboard shortcuts never act while the focus is in a text field. */
function inTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return (
    target instanceof HTMLInputElement &&
    !['checkbox', 'radio', 'button', 'submit', 'reset', 'file'].includes(target.type)
  );
}

/** One opened model, ready to draw. */
interface Opened {
  path: string;
  semantics: Semantics;
  layouter: Layouter;
}

export class Viewer {
  private readonly root: HTMLElement;
  private readonly engine = workerEngine();
  /** In watch mode the model is the author's file, so the page offers no other (INT-002). */
  private readonly watching: boolean;
  private path = '';
  private source = '';
  private opened: Opened | null = null;
  private picture: Picture | null = null;
  /** The fragment of the address the model was opened with, read when it is first drawn. */
  private link = '';
  private drawCount = 0;
  /** What the pending draw must honour, gathered over changes that arrive before it lands. */
  private arrival: Arrival = {};
  private readonly stage: Stage;
  private readonly notice: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly body: HTMLElement;
  private readonly sideWrap: HTMLElement;
  private readonly side: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly panelSwap: Swap;
  private readonly crumb: HTMLElement;
  private readonly crumbSwap: Swap;
  private readonly tabs: HTMLElement;
  private readonly thumb: HTMLElement;
  private readonly spoken: HTMLElement;
  private readonly themeButton: HTMLButtonElement;
  private readonly copyButton: HTMLButtonElement;
  private copyTimer = 0;
  private staleTimer = 0;
  private readonly motionBox: HTMLInputElement;
  /** The split editor's pane while it is open (INT-801), in place of the sidebar. */
  private editorPane: HTMLElement | null = null;
  /** INT-605: Play's clock, which moves the playing scenario on one step at each tick. */
  private readonly autoplay = new Autoplay(() => {
    this.autoplayTick();
  });
  /** INT-602: the playing scenario's side panel, changed in place as it moves. */
  private scenarioPanel: ScenarioPanel | null = null;

  constructor(root: HTMLElement, options: { watching?: boolean } = {}) {
    this.root = root;
    this.watching = options.watching ?? false;
    this.crumb = h('div', { class: 'crumb' });
    this.crumbSwap = new Swap(this.crumb);
    this.tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Written for' });
    this.thumb = h('span', { class: 'thumb', 'aria-hidden': 'true' });
    // INT-105: a screen reader hears each switch of audience.
    this.spoken = h('p', { class: 'sr-only', 'aria-live': 'polite' });
    this.themeButton = h('button', {
      type: 'button',
      class: 'tool theme',
      onclick: () => {
        this.toggleTheme();
      },
    });
    this.copyButton = h(
      'button',
      {
        type: 'button',
        class: 'tool copy',
        onclick: () => {
          void this.copyLink();
        },
      },
      ['Copy link'],
    );
    const brand = h('div', { class: 'brand' }, [h('span', { class: 'word' }, ['Aerie'])]);
    brand.insertAdjacentHTML('afterbegin', LOGO);
    const top = h('header', { class: 'top' }, [
      brand,
      this.crumb,
      h('div', { class: 'audience' }, [
        h('span', { class: 'written', 'aria-hidden': 'true' }, ['Written for']),
        this.tabs,
      ]),
      h('div', { class: 'tools' }, [this.copyButton, this.themeButton]),
      this.spoken,
    ]);
    this.motionBox = h('input', {
      type: 'checkbox',
      onchange: () => {
        this.setMotion(this.motionBox.checked ? 'reduce' : 'full', true);
      },
    });
    this.side = h('div', { class: 'side' });
    this.stage = new Stage(() => this.opened?.semantics.tree ?? null, {
      pick: (id) => {
        this.pick(id);
      },
      toggle: (id) => {
        this.toggle(id);
      },
    });
    this.notice = h('p', { class: 'notice', role: 'status', hidden: true });
    this.overlay = h('div', { class: 'overlay', hidden: true });
    this.stage.element.append(this.notice, this.overlay);
    this.panel = h('aside', { class: 'panel', 'aria-label': 'About' });
    this.panelSwap = new Swap(this.panel);
    this.sideWrap = h('nav', { class: 'side-wrap', 'aria-label': 'Diagram' }, [
      this.side,
      h('label', { class: 'motion' }, [this.motionBox, ' Reduce motion']),
    ]);
    this.body = h('div', { class: 'body' }, [this.sideWrap, this.stage.element, this.panel]);
    root.replaceChildren(top, this.body);
    document.addEventListener('keydown', (event) => {
      this.key(event);
    });
    window.addEventListener('popstate', () => {
      this.follow();
    });
    const theme = remembered(THEME_KEY);
    this.applyTheme(theme === 'light' || theme === 'dark' ? theme : null);
    const motion = remembered(MOTION_KEY);
    this.setMotion(motion === 'reduce' || motion === 'full' ? motion : null, false);
  }

  // ------------------------------------------------------------ preferences

  /** LOOK-002: the system's theme until the reader picks one, remembered on this device. */
  private applyTheme(choice: Theme | null): void {
    const html = document.documentElement;
    if (choice === null) delete html.dataset['theme'];
    else html.dataset['theme'] = choice;
    this.themeButton.textContent = this.currentTheme() === 'dark' ? 'Light' : 'Dark';
  }

  private currentTheme(): Theme {
    const chosen = document.documentElement.dataset['theme'];
    if (chosen === 'light' || chosen === 'dark') return chosen;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private toggleTheme(): void {
    const next: Theme = this.currentTheme() === 'dark' ? 'light' : 'dark';
    remember(THEME_KEY, next);
    this.applyTheme(next);
  }

  /** LOOK-903: reduced motion follows the system until the reader changes the checkbox. */
  private setMotion(choice: 'reduce' | 'full' | null, save: boolean): void {
    const html = document.documentElement;
    if (choice === null) delete html.dataset['motion'];
    else html.dataset['motion'] = choice;
    if (save && choice !== null) remember(MOTION_KEY, choice);
    this.motionBox.checked =
      choice === 'reduce' ||
      (choice === null && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // ------------------------------------------------------------ models

  /**
   * Opens a model from its source; a file with errors lists them instead of drawing. `link` is the
   * fragment of a shared link (INT-505): the model opens at its picture.
   */
  open(path: string, source: string, link = ''): Checked {
    // INT-501: the `model` query parameter names a bundled diagram, written as it is; a local file
    // has no address of its own.
    const url = new URL(location.href);
    url.search = SAMPLES.has(path) && !this.watching ? `?model=${encodeURI(path)}` : '';
    url.hash = link;
    history.replaceState(null, '', url);
    this.path = path;
    this.source = source;
    this.link = link;
    this.opened = null;
    this.picture = null;
    const result = check(source);
    const checked: Checked = {
      source,
      diagnostics: result.diagnostics,
      model: result.model,
      shown: result.model === null ? null : { source, model: result.model },
    };
    this.revise(checked);
    return checked;
  }

  /** The path and source of the model the page opened: the published model (INT-808). */
  get published(): { path: string; source: string } {
    return { path: this.path, source: this.source };
  }

  /**
   * INT-805, INT-806 and INT-852: a new version of the model's text. Without errors the diagram is
   * redrawn, keeping the view, audience, zoom state and selection wherever their ids still exist
   * (MODEL-603). With errors it keeps the last version without errors and says so at the top of the
   * stage; with nothing earlier to show, the stage lists the errors instead (INT-003).
   */
  revise(checked: Checked): void {
    if (checked.model === null) {
      if (this.opened !== null) {
        this.say(KEPT_NOTICE);
        return;
      }
      this.say(null);
      this.picture = null;
      this.drawCount++;
      this.showProblems(
        `${this.path} has problems, so Aerie cannot draw it:`,
        checked.diagnostics.filter((each) => each.severity === 'error').map(errorText),
      );
      this.renderControls(this.path);
      this.root.dataset['ready'] = 'true';
      return;
    }
    this.say(null);
    const semantics = new Semantics(checked.model);
    const before = this.picture;
    this.opened = { path: this.path, semantics, layouter: new Layouter(semantics, this.engine) };
    this.buildTabs();
    if (before !== null) {
      this.change(before, {}, 'replace');
      return;
    }
    // INT-505: a shared link opens at its picture, shown directly; parts that no longer fit the
    // model are dropped, and the reader is told.
    const linked = readFragment(semantics, this.link);
    this.link = '';
    if (linked.dropped.length > 0) this.warnStale();
    this.change(linked.picture, { fit: true }, 'replace');
  }

  /** Words at the top of the stage, over the diagram, or none. */
  say(text: string | null): void {
    this.notice.textContent = text ?? '';
    this.notice.hidden = text === null;
  }

  /** INT-505: says for six seconds that part of a link no longer matches the diagram. */
  private warnStale(): void {
    this.say(STALE_LINK);
    window.clearTimeout(this.staleTimer);
    this.staleTimer = window.setTimeout(() => {
      if (this.notice.textContent === STALE_LINK) this.say(null);
    }, STALE_FOR);
  }

  /** Something shown over the stage, such as watch mode's error list (INT-852), or nothing. */
  cover(content: Node | null): void {
    this.overlay.replaceChildren(...(content === null ? [] : [content]));
    this.overlay.hidden = content === null;
  }

  /** Adds a button to the top bar, before the theme button (LOOK-802). */
  addTool(tool: HTMLElement): void {
    this.themeButton.before(tool);
  }

  /** INT-801: shows the split editor's pane where the sidebar was, or the sidebar again. */
  showEditor(pane: HTMLElement | null): void {
    this.editorPane?.remove();
    this.editorPane = pane;
    if (pane === null) {
      this.body.prepend(this.sideWrap);
      this.body.classList.remove('editing');
    } else {
      this.sideWrap.replaceWith(pane);
      this.body.classList.add('editing');
    }
    this.renderControls(this.path);
  }

  /**
   * Sets the picture, normalised, writes it into the address and draws it. A change the reader
   * makes navigates: it adds a history entry when it moves to another view or activity (INT-506).
   */
  private change(picture: Picture, arrival: Arrival = {}, move: HistoryMove = 'navigate'): void {
    if (this.opened === null) return;
    const before = this.picture;
    this.picture = normalisePicture(this.opened.semantics, picture).picture;
    this.writeAddress(before, move);
    this.arrival = { ...this.arrival, ...arrival };
    // INT-606: Play stops with the scenario it plays.
    if (playingOf(before)?.scenario !== playingOf(this.picture)?.scenario) this.autoplay.stop();
    if (before !== null && before.audience !== this.picture.audience) {
      this.spoken.textContent = `Now written for ${this.opened.semantics.audience(this.picture.audience).name}`;
    }
    this.renderControls(this.opened.path);
    const count = ++this.drawCount;
    this.draw(count).catch((error: unknown) => {
      if (count !== this.drawCount) return;
      this.showProblems('Aerie could not draw this picture:', [
        error instanceof Error ? error.message : String(error),
      ]);
      this.root.dataset['ready'] = 'true';
    });
  }

  /** INT-501: the address always shows the current picture, in its fragment. */
  private writeAddress(before: Picture | null, move: HistoryMove): void {
    const opened = this.opened;
    const picture = this.picture;
    if (opened === null || picture === null) return;
    const url = new URL(location.href);
    url.hash = writeFragment(opened.semantics, picture);
    if (url.href === location.href) return;
    if (move === 'navigate' && before !== null && entry(before) !== entry(picture)) {
      history.pushState(null, '', url);
    } else {
      history.replaceState(null, '', url);
    }
  }

  /**
   * INT-506: Back and Forward, or a fragment typed into the address, show that picture. An entry
   * from before another bundled model was chosen opens that model again.
   */
  private follow(): void {
    const asked = new URL(location.href).searchParams.get('model');
    const sample = asked === null || this.watching ? undefined : SAMPLES.get(asked);
    if (asked !== null && asked !== this.path && sample !== undefined) {
      this.open(asked, sample, location.hash);
      return;
    }
    const opened = this.opened;
    const before = this.picture;
    if (opened === null || before === null) return;
    const read = readFragment(opened.semantics, location.hash);
    if (read.dropped.length > 0) this.warnStale();
    this.change(read.picture, read.picture.view === before.view ? {} : { fit: true }, 'replace');
  }

  /** INT-507: copies the full address; the button reads "Link copied" for a moment. */
  private async copyLink(): Promise<void> {
    let copied = true;
    try {
      await navigator.clipboard.writeText(location.href);
    } catch {
      // The clipboard may be refused; the address bar still holds the same link.
      copied = false;
    }
    const said = copied ? 'Link copied' : 'Not copied';
    this.copyButton.textContent = said;
    this.spoken.textContent = said;
    window.clearTimeout(this.copyTimer);
    this.copyTimer = window.setTimeout(() => {
      this.copyButton.textContent = 'Copy link';
    }, COPIED_FOR);
  }

  private showProblems(heading: string, lines: string[]): void {
    this.stage.showMessage(
      h('div', { class: 'problems', role: 'alert' }, [
        h('p', {}, [heading]),
        h(
          'ul',
          {},
          lines.map((line) => h('li', {}, [line])),
        ),
      ]),
    );
  }

  // ------------------------------------------------------------ what the reader does

  /** INT-201: clicking an element selects it; clicking it again or empty stage clears. */
  private pick(id: Id | null): void {
    const opened = this.opened;
    const picture = this.picture;
    if (opened === null || picture === null) return;
    const current = picture.activity.kind === 'selected' ? picture.activity.element : null;
    const next = id === null || id === current ? null : id;
    if (next === current) return;
    this.change(select(opened.semantics, picture, next));
  }

  /** Selects an element, revealing it if needed (INT-205, MODEL-207). */
  private choose(id: Id): void {
    const opened = this.opened;
    const picture = this.picture;
    if (opened === null || picture === null) return;
    this.change(select(opened.semantics, picture, id));
  }

  /** INT-302: opens a closed container in place, or closes an open one. */
  private toggle(id: Id): void {
    const opened = this.opened;
    const picture = this.picture;
    if (opened === null || picture === null) return;
    if (picture.activity.kind === 'presenting') return;
    const { semantics } = opened;
    const drawn = semantics.drawn(picture.view, picture.zoom);
    if (!drawn.has(id) || !semantics.tree.isContainer(id)) return;
    const open = semantics.scope(picture.view).state(drawn, id) === 'open';
    this.change(
      open ? closeContainer(semantics, picture, id) : openContainer(semantics, picture, id),
      { anchor: id },
    );
  }

  /** INT-102: switches the audience; wording changes and nothing moves (INT-103). */
  private switchTo(audience: Id): void {
    const opened = this.opened;
    const picture = this.picture;
    if (opened === null || picture === null || picture.audience === audience) return;
    this.change(switchAudience(opened.semantics, picture, audience));
  }

  /** The keyboard (INT-004, INT-102, INT-201, INT-352, INT-902). */
  private key(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (inTextField(event.target)) return;
    const opened = this.opened;
    const picture = this.picture;
    if (opened === null || picture === null) return;
    const target = event.target instanceof Element ? event.target : null;
    const node = target?.closest('svg.aerie g.boxes > g.node') ?? null;
    const nodeId = node?.getAttribute('data-id') ?? null;
    const tab = target?.closest('[role=tab]') ?? null;
    let handled = true;
    const playing = picture.activity.kind === 'playing';
    if (/^[1-6]$/.test(event.key)) {
      const audience = opened.semantics.model.audiences[Number(event.key) - 1];
      if (audience === undefined) return;
      this.switchTo(audience.id);
    } else if (tab !== null && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      // The tab list's own keys: the arrows move along the tabs and choose them.
      const all = opened.semantics.model.audiences;
      const at = all.findIndex((each) => each.id === picture.audience);
      const next = all[(at + (event.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
      if (next === undefined) return;
      this.switchTo(next.id);
      this.tabs.querySelector<HTMLElement>(`[data-audience="${CSS.escape(next.id)}"]`)?.focus();
    } else if (event.key === 'Escape') {
      if (playing) this.scenarioActions.done();
      else if (picture.activity.kind === 'selected')
        this.change(select(opened.semantics, picture, null));
      else return;
    } else if (playing && event.key === 'ArrowRight') {
      this.scenarioActions.forward();
    } else if (playing && event.key === 'ArrowLeft') {
      this.scenarioActions.back();
    } else if (playing && event.key === ' ' && !pressable(event.target)) {
      this.scenarioActions.playOrPause();
    } else if (nodeId !== null && (event.key === 'Enter' || event.key === ' ')) {
      if (picture.activity.kind === 'selected' && picture.activity.element === nodeId) return;
      this.choose(nodeId);
    } else if (nodeId !== null && event.key === 'o') {
      this.toggle(nodeId);
    } else if (event.key === '+' || event.key === '=') {
      this.stage.magnifyBy(CAMERA.magnify);
    } else if (event.key === '-') {
      this.stage.magnifyBy(CAMERA.shrink);
    } else if (event.key === '0') {
      this.stage.fit(true);
    } else {
      handled = false;
    }
    if (handled) event.preventDefault();
  }

  // ------------------------------------------------------------ drawing

  private async draw(count: number): Promise<void> {
    const opened = this.opened;
    const picture = this.picture;
    if (opened === null || picture === null) return;
    const { semantics, layouter } = opened;
    const { view, zoom, audience, activity } = picture;
    let showing: Showing;
    const caption =
      activity.kind === 'playing'
        ? captionOf(semantics, activity.scenario, activity.step, audience)
        : null;
    if (activity.kind === 'playing' && activity.lanes) {
      const lanes = await layouter.lanes(activity.scenario, view, zoom);
      showing = {
        markup: toMarkup(renderLanes(semantics, lanes, audience, activity.step)),
        layout: null,
        lanes,
        sentences: [],
        caption,
      };
    } else {
      const laid = await layouter.picture(view, zoom, audience);
      let focus: Focus = { kind: 'none' };
      let trail;
      if (activity.kind === 'selected') focus = { kind: 'select', ids: [activity.element] };
      if (activity.kind === 'playing') {
        const steps = semantics.trail(activity.scenario, view, zoom, activity.step);
        trail = trailShapes(laid.result, steps);
        focus = { kind: 'trail', visited: steps.visited, current: steps.current };
      }
      const scene = semantics.scene(laid.drawing, audience);
      showing = {
        markup: toMarkup(
          renderPicture(
            semantics,
            laid,
            trail === undefined
              ? { focus, interactive: true }
              : { focus, trail, interactive: true },
          ),
        ),
        layout: laid,
        lanes: null,
        sentences: scene.edges.flatMap((edge) => edge.relationships.map((each) => each.sentence)),
        caption,
      };
    }
    if (count !== this.drawCount) return;
    const arrival = this.arrival;
    this.arrival = {};
    this.stage.show(showing, arrival);
    await Promise.all(FACES.map((face) => document.fonts.load(face)));
    await document.fonts.ready;
    if (count === this.drawCount) this.root.dataset['ready'] = 'true';
  }

  // ------------------------------------------------------------ controls

  /** INT-101 and INT-105: one tab per audience, in declared order, as an accessible tab list. */
  private buildTabs(): void {
    const opened = this.opened;
    if (opened === null) return;
    this.tabs.replaceChildren(
      ...opened.semantics.model.audiences.map((each) =>
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'data-audience': each.id,
            onclick: () => {
              this.switchTo(each.id);
            },
          },
          [each.name],
        ),
      ),
      this.thumb,
    );
  }

  /** Marks the current audience's tab; the underline glides to it (LOOK-802). */
  private markTabs(audience: Id): void {
    const opened = this.opened;
    if (opened === null) return;
    const index = opened.semantics.model.audiences.findIndex((each) => each.id === audience);
    for (const tab of this.tabs.querySelectorAll<HTMLElement>('[role=tab]')) {
      const on = tab.dataset['audience'] === audience;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
    }
    this.thumb.style.transform = `translateX(${String(index * TAB_WIDTH)}px)`;
  }

  /** The actions of the side panel's links and buttons, on the picture as it is when used. */
  private readonly panelActions: PanelActions = {
    select: (id) => {
      this.choose(id);
    },
    toggle: (id) => {
      this.toggle(id);
    },
    play: (scenario) => {
      this.playScenario(scenario);
    },
  };

  // ------------------------------------------------------------ scenario playback

  /**
   * INT-601: plays a scenario from step 1 on its stage view (MODEL-404), clearing the selection,
   * with the camera fitted around the caption bar. Starting another scenario stops the one playing
   * (INT-606). The side panel's scenario buttons call it, and so does the navigation sidebar
   * (INT-403).
   */
  playScenario(scenario: Id): void {
    const opened = this.opened;
    const picture = this.picture;
    if (opened === null || picture === null || !opened.semantics.hasScenario(scenario)) return;
    this.autoplay.stop();
    this.change(play(opened.semantics, picture, scenario), { fit: true });
  }

  /** INT-605: ends the playing scenario and returns to its view, fitted. */
  endScenario(): void {
    const opened = this.opened;
    const picture = this.picture;
    if (opened === null || picture?.activity.kind !== 'playing') return;
    this.autoplay.stop();
    this.change(stop(opened.semantics, picture), { fit: true });
  }

  /** Moves the playing scenario to a step, clamped to its steps (MODEL-603), as lanes or not. */
  private playAt(step: number, lanes?: boolean): void {
    const opened = this.opened;
    const picture = this.picture;
    const playing = playingOf(picture);
    if (opened === null || picture === null || playing === null) return;
    const count = opened.semantics.scenario(playing.scenario).steps.length;
    const next = {
      ...playing,
      step: Math.min(Math.max(step, 1), count),
      lanes: lanes ?? playing.lanes,
    };
    if (next.step === playing.step && next.lanes === playing.lanes) return;
    // INT-604: the map and the lanes are each fitted when the reader switches between them.
    this.change({ ...picture, activity: next }, next.lanes === playing.lanes ? {} : { fit: true });
  }

  /** INT-605: Play's clock moves one step on, and stops on the last step. */
  private autoplayTick(): void {
    const opened = this.opened;
    const playing = playingOf(this.picture);
    if (opened === null || playing === null) {
      this.autoplay.stop();
      return;
    }
    const count = opened.semantics.scenario(playing.scenario).steps.length;
    if (playing.step >= count - 1) this.autoplay.stop();
    if (playing.step < count) this.playAt(playing.step + 1);
    else this.refreshPlayer();
  }

  /** The scenario panel's controls and the keys of INT-605. */
  private readonly scenarioActions: ScenarioActions = {
    back: () => {
      const playing = playingOf(this.picture);
      if (playing === null) return;
      this.autoplay.stop();
      this.playAt(playing.step - 1);
      this.refreshPlayer();
    },
    forward: () => {
      const playing = playingOf(this.picture);
      if (playing === null) return;
      this.autoplay.stop();
      this.playAt(playing.step + 1);
      this.refreshPlayer();
    },
    playOrPause: () => {
      const opened = this.opened;
      const playing = playingOf(this.picture);
      if (opened === null || playing === null) return;
      if (this.autoplay.running) {
        this.autoplay.stop();
      } else {
        // Play on the last step starts again from step 1.
        const count = opened.semantics.scenario(playing.scenario).steps.length;
        if (playing.step >= count) this.playAt(1);
        if (count > 1) this.autoplay.start();
      }
      this.refreshPlayer();
    },
    done: () => {
      this.endScenario();
    },
    lanes: (on) => {
      const playing = playingOf(this.picture);
      if (playing !== null) this.playAt(playing.step, on);
    },
    step: (step) => {
      this.autoplay.stop();
      this.playAt(step);
      this.refreshPlayer();
    },
  };

  /** Brings the scenario panel's controls up to date with the picture and Play's clock. */
  private refreshPlayer(): void {
    const playing = playingOf(this.picture);
    if (playing === null || this.scenarioPanel === null) return;
    this.scenarioPanel.update({
      step: playing.step,
      lanes: playing.lanes,
      running: this.autoplay.running,
    });
  }

  /**
   * INT-801: while editing, the sidebar is hidden and the breadcrumb's view title opens a menu of
   * the views and scenarios instead (walkthroughs join it when they can be presented, A9).
   */
  private viewMenu(title: string, here: boolean): HTMLElement {
    const opened = this.opened;
    const picture = this.picture;
    // A popover, so the menu is not clipped by the breadcrumb and closes on a click elsewhere.
    const menu = h('div', { class: 'crumb-menu', role: 'menu', id: 'view-menu', popover: 'auto' });
    const button = h(
      'button',
      {
        type: 'button',
        class: here ? 'crumb-title here' : 'crumb-title',
        'aria-haspopup': 'menu',
        popovertarget: 'view-menu',
      },
      [title],
    );
    menu.addEventListener('beforetoggle', () => {
      const at = button.getBoundingClientRect();
      menu.style.left = `${String(at.left)}px`;
      menu.style.top = `${String(at.bottom + 6)}px`;
    });
    if (opened !== null && picture !== null) {
      const { semantics } = opened;
      const item = (text: string, choose: () => Picture): HTMLElement =>
        h(
          'button',
          {
            type: 'button',
            role: 'menuitem',
            onclick: () => {
              this.change(choose());
            },
          },
          [text],
        );
      menu.append(
        h('p', { class: 'heading' }, ['Views']),
        ...semantics.views.map((view) =>
          item(semantics.viewTitle(view.id, picture.audience), () => {
            return switchView(semantics, picture, view.id);
          }),
        ),
      );
      if (semantics.model.scenarios.length > 0) {
        menu.append(
          h('p', { class: 'heading' }, ['Scenarios']),
          ...semantics.model.scenarios.map((scenario) =>
            item(scenarioTitle(semantics, scenario.id, picture.audience), () =>
              play(semantics, picture, scenario.id),
            ),
          ),
        );
      }
    }
    return h('span', {}, [button, menu]);
  }

  /**
   * INT-403: choosing a walkthrough presents it from its first step. Presenter mode itself is slice
   * A9's; until then the sidebar offers the bare controls, as it does for scenarios.
   */
  private walkthroughSection(semantics: Semantics, picture: Picture): HTMLElement {
    const presenting = picture.activity.kind === 'presenting' ? picture.activity : null;
    const items = semantics.model.walkthroughs.map((walkthrough) =>
      h(
        'button',
        {
          type: 'button',
          class: presenting?.walkthrough === walkthrough.id ? 'item on' : 'item',
          'aria-current': presenting?.walkthrough === walkthrough.id ? 'true' : null,
          'data-walkthrough': walkthrough.id,
          onclick: () => {
            const now = this.picture;
            if (now === null) return;
            this.change(present(semantics, now, walkthrough.id), { fit: true });
          },
        },
        [wordsFor(walkthrough.title, picture.audience) ?? walkthrough.id],
      ),
    );
    const controls: Node[] = [];
    if (presenting !== null) {
      const count = semantics.walkthrough(presenting.walkthrough).steps.length;
      controls.push(
        h('label', { class: 'step' }, [
          'Step ',
          h('input', {
            type: 'number',
            name: 'walk-step',
            min: 1,
            max: count,
            value: presenting.step,
            onchange: (event) => {
              const step = Number((event.target as HTMLInputElement).value);
              this.change(presentStep(semantics, picture, step));
            },
          }),
          ` of ${String(count)}`,
        ]),
        h(
          'button',
          {
            type: 'button',
            class: 'tool',
            onclick: () => {
              this.change(stop(semantics, picture));
            },
          },
          ['Done'],
        ),
      );
    }
    return h('section', {}, [h('h2', {}, ['Walkthroughs']), ...items, ...controls]);
  }

  private renderControls(path: string): void {
    const opened = this.opened;
    const picture = this.picture;
    const models = h(
      'select',
      {
        'aria-label': 'Model',
        name: 'model',
        onchange: (event) => {
          const chosen = (event.target as HTMLSelectElement).value;
          const source = SAMPLES.get(chosen);
          if (source !== undefined) this.open(chosen, source);
        },
      },
      [...SAMPLES.keys()].map((each) =>
        h('option', { value: each, selected: each === path }, [each]),
      ),
    );
    if (!SAMPLES.has(path)) models.prepend(h('option', { value: path, selected: true }, [path]));
    const file = h('input', {
      type: 'file',
      accept: '.aerie,text/plain',
      'aria-label': 'Open a .aerie file',
      onchange: (event) => {
        const chosen = (event.target as HTMLInputElement).files?.[0];
        if (chosen !== undefined)
          void chosen.text().then((source) => {
            this.open(chosen.name, source);
          });
      },
    });
    const sections: Node[] = this.watching
      ? []
      : [
          h('section', {}, [
            h('h2', {}, ['Diagram']),
            models,
            h('label', { class: 'file' }, ['Open a file', file]),
          ]),
        ];
    if (opened === null || picture === null) {
      this.side.replaceChildren(...sections);
      this.tabs.replaceChildren();
      this.crumbSwap.set(h('span', {}, [path]));
      this.panelSwap.set(h('div', { class: 'panel-content' }));
      return;
    }
    const { semantics } = opened;
    const audience = picture.audience;
    const activity = picture.activity;

    // INT-401 to INT-404: views, scenarios and walkthroughs, each titled for the audience; the
    // current view, or what plays or is presented, is marked.
    const reading = activity.kind === 'reading' || activity.kind === 'selected';
    sections.push(
      h('section', {}, [
        h('h2', {}, ['Views']),
        ...semantics.views.map((view) =>
          h(
            'button',
            {
              type: 'button',
              class: view.id === picture.view && reading ? 'item on' : 'item',
              'aria-current': view.id === picture.view && reading ? 'true' : null,
              'data-view': view.id,
              onclick: () => {
                const now = this.picture;
                if (now === null) return;
                this.change(switchView(semantics, now, view.id), { fit: true });
              },
            },
            [semantics.viewTitle(view.id, audience)],
          ),
        ),
      ]),
    );

    if (semantics.model.scenarios.length > 0) {
      const playing = activity.kind === 'playing' ? activity : null;
      const scenarios = semantics.model.scenarios.map((scenario) =>
        h(
          'button',
          {
            type: 'button',
            class: playing?.scenario === scenario.id ? 'item on' : 'item',
            'aria-current': playing?.scenario === scenario.id ? 'true' : null,
            'data-scenario': scenario.id,
            onclick: () => {
              this.panelActions.play(scenario.id);
            },
          },
          [
            h('span', { class: 'play', 'aria-hidden': 'true' }),
            scenarioTitle(semantics, scenario.id, audience),
          ],
        ),
      );
      sections.push(h('section', {}, [h('h2', {}, ['Scenarios']), ...scenarios]));
    }
    if (semantics.model.walkthroughs.length > 0) {
      sections.push(this.walkthroughSection(semantics, picture));
    }
    // A reader choosing from the sidebar with the keyboard keeps their place in it.
    const active = document.activeElement;
    const kept =
      active instanceof HTMLElement && this.side.contains(active)
        ? ['data-view', 'data-scenario', 'data-walkthrough', 'name']
            .map((name) => [name, active.getAttribute(name)] as const)
            .find(([, value]) => value !== null)
        : undefined;
    this.side.replaceChildren(...sections);
    if (kept !== undefined) {
      const [name, value] = kept;
      this.side.querySelector<HTMLElement>(`[${name}="${CSS.escape(value ?? '')}"]`)?.focus();
    }
    this.markTabs(audience);

    const title = semantics.title(audience);
    const crumbs: string[] = [
      title ?? semantics.model.id ?? 'Untitled',
      semantics.viewTitle(picture.view, audience),
    ];
    if (activity.kind === 'playing')
      crumbs.push(scenarioTitle(semantics, activity.scenario, audience));
    this.crumbSwap.set(
      h(
        'span',
        {},
        crumbs.flatMap((each, at) => [
          ...(at === 0 ? [] : [h('span', { class: 'slash', 'aria-hidden': 'true' }, ['/'])]),
          at === 1 && this.editorPane !== null
            ? this.viewMenu(each, at === crumbs.length - 1)
            : h('span', { class: at === crumbs.length - 1 ? 'here' : '' }, [each]),
        ]),
      ),
    );

    // INT-204, INT-205 and INT-602: the side panel; when the reader was in it, the focus stays in
    // it, on the same control of a scenario's panel.
    const hadFocus = this.panel.contains(document.activeElement);
    if (activity.kind === 'playing') {
      const was = this.scenarioPanel;
      const kept = was?.focusKey() ?? null;
      const panel = was?.shows(semantics, activity.scenario, audience)
        ? was
        : new ScenarioPanel(semantics, activity.scenario, audience, this.scenarioActions);
      this.scenarioPanel = panel;
      this.panelSwap.set(panel.element, (replaced) => {
        // A new model's panel that reads the same as the one shown leaves that one in place.
        if (!replaced && !panel.element.isConnected && was !== null) this.scenarioPanel = was;
        this.refreshPlayer();
        if (!replaced || !hadFocus) return;
        if (kept === null) this.panel.querySelector<HTMLElement>('h1')?.focus();
        else panel.focus(kept);
      });
      this.refreshPlayer();
      return;
    }
    this.scenarioPanel = null;
    const content =
      activity.kind === 'selected'
        ? elementPanel(semantics, picture, activity.element, this.panelActions)
        : viewPanel(semantics, picture, this.panelActions);
    this.panelSwap.set(h('div', { class: 'panel-content' }, content), (replaced) => {
      if (replaced && hadFocus) this.panel.querySelector<HTMLElement>('h1')?.focus();
    });
  }
}

/** The playing scenario of a picture, or null. */
function playingOf(picture: Picture | null): Extract<Activity, { kind: 'playing' }> | null {
  return picture?.activity.kind === 'playing' ? picture.activity : null;
}

/** Starts the page: the model named by `?model=`, else the first sample, at the link's picture. */
export function start(root: HTMLElement): Viewer {
  const viewer = new Viewer(root);
  const asked = new URL(location.href).searchParams.get('model');
  const path = asked !== null && SAMPLES.has(asked) ? asked : FIRST_SAMPLE;
  viewer.open(path, SAMPLES.get(path) ?? '', location.hash);
  return viewer;
}
