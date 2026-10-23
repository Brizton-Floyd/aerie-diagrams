// The viewer page (`npm run dev`): opens a bundled sample or a local .aerie file and draws a chosen
// view for a chosen audience in the Contour look, with the page grid of LOOK-801. It is the minimal
// page that shows Aerie drawing; the interactions of docs/spec/interaction.md build on it. The split
// editor (editing.ts) and watch mode (watching.ts) give it new versions of the model to draw.
import {
  check,
  defaultPicture,
  normalisePicture,
  play,
  select,
  stop,
  switchAudience,
  switchView,
  DEFAULT_ZOOM,
  Semantics,
  type Picture,
  type Zoom,
} from '../model/index.ts';
import type { Id } from '../lines/index.ts';
import { Layouter, fitScale, trailShapes } from '../layout/index.ts';
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
import { h, prose } from './dom.ts';
import { KEPT_NOTICE, errorText, type Checked } from './live.ts';
import { LOGO } from './logo.ts';
import { FIRST_SAMPLE, SAMPLES } from './samples.ts';

/** The zoom presets the page offers (MODEL-211's states). */
type ZoomPreset = 'default' | 'open' | 'closed';

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
  private zoomPreset: ZoomPreset = 'default';
  private drawCount = 0;
  private readonly stage: HTMLElement;
  private readonly drawingHolder: HTMLElement;
  private readonly notice: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly body: HTMLElement;
  private readonly sideWrap: HTMLElement;
  private readonly side: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly crumb: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly themeButton: HTMLButtonElement;
  private readonly motionBox: HTMLInputElement;
  /** The split editor's pane while it is open (INT-801), in place of the sidebar. */
  private editorPane: HTMLElement | null = null;

  constructor(root: HTMLElement, options: { watching?: boolean } = {}) {
    this.root = root;
    this.watching = options.watching ?? false;
    this.crumb = h('div', { class: 'crumb' });
    this.tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Written for' });
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
        h('span', { class: 'written' }, ['Written for']),
        this.tabs,
      ]),
      h('div', { class: 'tools' }, [this.themeButton]),
    ]);
    this.motionBox = h('input', {
      type: 'checkbox',
      onchange: () => {
        this.setMotion(this.motionBox.checked ? 'reduce' : 'full', true);
      },
    });
    this.side = h('nav', { class: 'side', 'aria-label': 'Diagram' });
    this.drawingHolder = h('div', { class: 'drawing' });
    this.notice = h('p', { class: 'notice', role: 'status', hidden: true });
    this.overlay = h('div', { class: 'overlay', hidden: true });
    this.stage = h('main', { class: 'aerie-stage' }, [
      this.drawingHolder,
      this.notice,
      this.overlay,
    ]);
    this.panel = h('aside', { class: 'panel' });
    this.sideWrap = h('div', { class: 'side-wrap' }, [
      this.side,
      h('label', { class: 'motion' }, [this.motionBox, ' Reduce motion']),
    ]);
    this.body = h('div', { class: 'body' }, [this.sideWrap, this.stage, this.panel]);
    root.replaceChildren(top, this.body);
    new ResizeObserver(() => {
      this.fit();
    }).observe(this.stage);
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
    this.zoomPreset = 'default';
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
    this.change(before ?? defaultPicture(semantics));
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
  private change(picture: Picture): void {
    if (this.opened === null) return;
    this.picture = normalisePicture(this.opened.semantics, picture).picture;
    this.renderControls(this.opened.path);
    const count = this.drawCount + 1;
    this.draw().catch((error: unknown) => {
      if (count !== this.drawCount) return;
      this.showProblems('Aerie could not draw this picture:', [
        error instanceof Error ? error.message : String(error),
      ]);
      this.root.dataset['ready'] = 'true';
    });
  }

  private showProblems(heading: string, lines: string[]): void {
    this.drawingHolder.replaceChildren(
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

  private zoomFor(preset: ZoomPreset, view: Id): Zoom {
    if (this.opened === null || preset === 'default') return DEFAULT_ZOOM;
    const scope = this.opened.semantics.scope(view);
    return preset === 'open' ? scope.everythingOpen() : scope.allClosed();
  }

  // ------------------------------------------------------------ drawing

  private async draw(): Promise<void> {
    const opened = this.opened;
    const picture = this.picture;
    if (opened === null || picture === null) return;
    const count = ++this.drawCount;
    const { semantics, layouter } = opened;
    const { view, zoom, audience, activity } = picture;
    let markup: string;
    if (activity.kind === 'playing' && activity.lanes) {
      const lanes = await layouter.lanes(activity.scenario, view, zoom);
      markup = toMarkup(renderLanes(semantics, lanes, audience, activity.step));
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
      markup = toMarkup(
        renderPicture(semantics, laid, trail === undefined ? { focus } : { focus, trail }),
      );
    }
    if (count !== this.drawCount) return;
    this.drawingHolder.innerHTML = markup;
    this.fit();
    await Promise.all(FACES.map((face) => document.fonts.load(face)));
    await document.fonts.ready;
    if (count === this.drawCount) this.root.dataset['ready'] = 'true';
  }

  /** LAYOUT-451: the picture fills the stage less a margin, at no more than 1.15, centred. */
  private fit(): void {
    const svg = this.drawingHolder.querySelector<SVGSVGElement>('svg.aerie');
    if (svg === null) return;
    const size = { width: svg.width.baseVal.value, height: svg.height.baseVal.value };
    const stage = { width: this.stage.clientWidth, height: this.stage.clientHeight };
    const scale = fitScale(size, stage);
    const width = size.width * scale;
    const height = size.height * scale;
    svg.style.width = `${String(width)}px`;
    svg.style.height = `${String(height)}px`;
    svg.style.left = `${String((stage.width - width) / 2)}px`;
    svg.style.top = `${String(Math.max(34, (stage.height - height) / 2))}px`;
  }

  // ------------------------------------------------------------ controls

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
            this.zoomPreset = 'default';
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
      this.crumb.replaceChildren(path);
      this.panel.replaceChildren();
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
                this.zoomPreset = 'default';
                this.change(switchView(semantics, picture, view.id));
              },
            },
            [semantics.viewTitle(view.id, audience)],
          ),
        ),
      ]),
    );

    const zoom = h(
      'select',
      {
        'aria-label': 'Zoom',
        name: 'zoom',
        onchange: (event) => {
          this.zoomPreset = (event.target as HTMLSelectElement).value as ZoomPreset;
          this.change({ ...picture, zoom: this.zoomFor(this.zoomPreset, picture.view) });
        },
      },
      (
        [
          ['default', 'As the view opens'],
          ['open', 'Everything open'],
          ['closed', 'All closed'],
        ] as const
      ).map(([value, text]) => h('option', { value, selected: value === this.zoomPreset }, [text])),
    );
    const drawn = semantics.drawing(picture.view, picture.zoom).nodes;
    const highlight = h(
      'select',
      {
        'aria-label': 'Selected element',
        name: 'select',
        disabled: activity.kind === 'playing',
        onchange: (event) => {
          const id = (event.target as HTMLSelectElement).value;
          this.change(select(semantics, picture, id === '' ? null : id));
        },
      },
      [
        h('option', { value: '' }, ['Nothing']),
        ...drawn.map((node) =>
          h(
            'option',
            {
              value: node.id,
              selected: activity.kind === 'selected' && activity.element === node.id,
            },
            [semantics.name(node.id, audience)],
          ),
        ),
      ],
    );
    sections.push(
      h('section', {}, [h('h2', {}, ['Zoom']), zoom]),
      h('section', {}, [h('h2', {}, ['Selection']), highlight]),
    );

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
              this.change(play(semantics, picture, scenario.id));
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
    this.side.replaceChildren(...sections);

    // LOOK-802: the audience tabs, with the accent underline under the current one.
    const index = semantics.model.audiences.findIndex((each) => each.id === audience);
    this.tabs.replaceChildren(
      ...semantics.model.audiences.map((each) =>
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': each.id === audience ? 'true' : 'false',
            'data-audience': each.id,
            onclick: () => {
              this.change(switchAudience(semantics, picture, each.id));
            },
          },
          [each.name],
        ),
      ),
      h('span', { class: 'thumb', style: `transform: translateX(${String(index * 104)}px)` }),
    );

    const title = semantics.title(audience);
    const crumbs: string[] = [
      title ?? semantics.model.id ?? 'Untitled',
      semantics.viewTitle(picture.view, audience),
    ];
    if (activity.kind === 'playing')
      crumbs.push(scenarioTitle(semantics, activity.scenario, audience));
    this.crumb.replaceChildren(
      ...crumbs.flatMap((each, at) => [
        ...(at === 0 ? [] : [h('span', { class: 'slash', 'aria-hidden': 'true' }, ['/'])]),
        at === 1 && this.editorPane !== null
          ? this.viewMenu(each, at === crumbs.length - 1)
          : h('span', { class: at === crumbs.length - 1 ? 'here' : '' }, [each]),
      ]),
    );

    const about = semantics.scene(semantics.drawing(picture.view, picture.zoom), audience).about;
    this.panel.replaceChildren(
      h('p', { class: 'kicker' }, ['View']),
      h('h1', {}, [semantics.viewTitle(picture.view, audience)]),
      ...(about === null
        ? []
        : about.split(/\n\n+/).map((para) => h('p', { class: 'lead' }, prose(para)))),
    );
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
