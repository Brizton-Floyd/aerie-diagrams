// The viewer page (`npm run dev`; docs/spec/interaction.md): opens a bundled sample or a local .aerie
// file and lets a reader explore it in the Contour look, with the page grid of LOOK-801. A reader
// selects an element to read about it in the side panel (INT-201 to INT-206), opens containers in
// place (INT-301 to INT-304), switches the audience without moving anything (INT-101 to INT-105),
// moves the camera (INT-351 to INT-353), and does all of it from the keyboard too (INT-901 to
// INT-905). The navigation sidebar and shared links (A7) and scenario playback (A8) build on it.
// The split editor (editing.ts) and watch mode (watching.ts) give it new versions of the model.
import {
  check,
  closeContainer,
  defaultPicture,
  normalisePicture,
  openContainer,
  play,
  select,
  stop,
  switchAudience,
  switchView,
  Semantics,
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
import { KEPT_NOTICE, errorText, type Checked } from './live.ts';
import { LOGO } from './logo.ts';
import { Swap } from './motion.ts';
import { elementPanel, viewPanel, type PanelActions } from './panel.ts';
import { FIRST_SAMPLE, SAMPLES } from './samples.ts';
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
  private readonly motionBox: HTMLInputElement;
  /** The split editor's pane while it is open (INT-801), in place of the sidebar. */
  private editorPane: HTMLElement | null = null;

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
    const brand = h('div', { class: 'brand' }, [h('span', { class: 'word' }, ['Aerie'])]);
    brand.insertAdjacentHTML('afterbegin', LOGO);
    const top = h('header', { class: 'top' }, [
      brand,
      this.crumb,
      h('div', { class: 'audience' }, [
        h('span', { class: 'written', 'aria-hidden': 'true' }, ['Written for']),
        this.tabs,
      ]),
      h('div', { class: 'tools' }, [this.themeButton]),
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

  /** Opens a model from its source; a file with errors lists them instead of drawing. */
  open(path: string, source: string): Checked {
    // INT-501: the `model` query parameter names a bundled diagram, written as it is; a local file
    // has no address of its own.
    const url = new URL(location.href);
    url.search = SAMPLES.has(path) && !this.watching ? `?model=${encodeURI(path)}` : '';
    history.replaceState(null, '', url);
    this.path = path;
    this.source = source;
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
    this.change(before ?? defaultPicture(semantics), before === null ? { fit: true } : {});
  }

  /** Words at the top of the stage, over the diagram, or none. */
  say(text: string | null): void {
    this.notice.textContent = text ?? '';
    this.notice.hidden = text === null;
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

  /** Sets the picture, normalised, and draws it. */
  private change(picture: Picture, arrival: Arrival = {}): void {
    if (this.opened === null) return;
    const before = this.picture;
    this.picture = normalisePicture(this.opened.semantics, picture).picture;
    this.arrival = { ...this.arrival, ...arrival };
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
      if (picture.activity.kind !== 'selected') return;
      this.change(select(opened.semantics, picture, null));
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
    if (activity.kind === 'playing' && activity.lanes) {
      const lanes = await layouter.lanes(activity.scenario, view, zoom);
      showing = {
        markup: toMarkup(renderLanes(semantics, lanes, audience, activity.step)),
        layout: null,
        sentences: [],
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
        sentences: scene.edges.flatMap((edge) => edge.relationships.map((each) => each.sentence)),
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
      const opened = this.opened;
      const picture = this.picture;
      if (opened === null || picture === null) return;
      this.change(play(opened.semantics, picture, scenario));
    },
  };

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

    sections.push(
      h('section', {}, [
        h('h2', {}, ['Views']),
        ...semantics.views.map((view) =>
          h(
            'button',
            {
              type: 'button',
              class: view.id === picture.view && activity.kind !== 'playing' ? 'item on' : 'item',
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

    // Scenario playback is slice A8's; until then the sidebar offers the bare controls.
    if (semantics.model.scenarios.length > 0) {
      const playing = activity.kind === 'playing' ? activity : null;
      const scenarios = semantics.model.scenarios.map((scenario) =>
        h(
          'button',
          {
            type: 'button',
            class: playing?.scenario === scenario.id ? 'item on' : 'item',
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
      const controls: Node[] = [];
      if (playing !== null) {
        const count = semantics.scenario(playing.scenario).steps.length;
        controls.push(
          h('label', { class: 'step' }, [
            'Step ',
            h('input', {
              type: 'number',
              name: 'step',
              min: 1,
              max: count,
              value: playing.step,
              onchange: (event) => {
                const step = Number((event.target as HTMLInputElement).value);
                this.change({ ...picture, activity: { ...playing, step } });
              },
            }),
            ` of ${String(count)}`,
          ]),
          h('label', { class: 'check' }, [
            h('input', {
              type: 'checkbox',
              name: 'lanes',
              checked: playing.lanes,
              onchange: (event) => {
                const lanes = (event.target as HTMLInputElement).checked;
                this.change({ ...picture, activity: { ...playing, lanes } });
              },
            }),
            ' As lanes',
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
      sections.push(h('section', {}, [h('h2', {}, ['Scenarios']), ...scenarios, ...controls]));
    }
    // A reader choosing from the sidebar with the keyboard keeps their place in it.
    const active = document.activeElement;
    const kept =
      active instanceof HTMLElement && this.side.contains(active)
        ? ['data-view', 'data-scenario', 'name']
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

    // INT-204 and INT-205: the side panel; when the reader was in it, the focus stays in it.
    const content =
      activity.kind === 'selected'
        ? elementPanel(semantics, picture, activity.element, this.panelActions)
        : viewPanel(semantics, picture, this.panelActions);
    const hadFocus = this.panel.contains(document.activeElement);
    this.panelSwap.set(h('div', { class: 'panel-content' }, content), (replaced) => {
      if (replaced && hadFocus) this.panel.querySelector<HTMLElement>('h1')?.focus();
    });
  }
}

/** Starts the page: the model named by `?model=`, else the first sample. */
export function start(root: HTMLElement): Viewer {
  const viewer = new Viewer(root);
  const asked = new URL(location.href).searchParams.get('model');
  const path = asked !== null && SAMPLES.has(asked) ? asked : FIRST_SAMPLE;
  viewer.open(path, SAMPLES.get(path) ?? '');
  return viewer;
}
