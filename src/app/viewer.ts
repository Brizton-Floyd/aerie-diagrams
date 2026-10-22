// The viewer page (`npm run dev`): opens a bundled sample or a local .aerie file and draws a chosen
// view for a chosen audience in the Contour look, with the page grid of LOOK-801. It is the minimal
// page that shows Aerie drawing; the interactions of docs/spec/interaction.md build on it.
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
  private opened: Opened | null = null;
  private picture: Picture | null = null;
  private zoomPreset: ZoomPreset = 'default';
  private drawCount = 0;
  private readonly stage: HTMLElement;
  private readonly drawingHolder: HTMLElement;
  private readonly side: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly crumb: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly themeButton: HTMLButtonElement;
  private readonly motionBox: HTMLInputElement;

  constructor(root: HTMLElement) {
    this.root = root;
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
    this.stage = h('main', { class: 'aerie-stage' }, [this.drawingHolder]);
    this.panel = h('aside', { class: 'panel' });
    root.replaceChildren(
      top,
      h('div', { class: 'body' }, [
        h('div', { class: 'side-wrap' }, [
          this.side,
          h('label', { class: 'motion' }, [this.motionBox, ' Reduce motion']),
        ]),
        this.stage,
        this.panel,
      ]),
    );
    new ResizeObserver(() => {
      this.fit();
    }).observe(this.stage);
    this.applyTheme((remembered(THEME_KEY) as Theme | null) ?? null);
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
  open(path: string, source: string): void {
    const result = check(source);
    // INT-501: the `model` query parameter names a bundled diagram, written as it is; a local file
    // has no address of its own.
    const url = new URL(location.href);
    url.search = SAMPLES.has(path) ? `?model=${encodeURI(path)}` : '';
    history.replaceState(null, '', url);
    if (result.model === null) {
      this.opened = null;
      this.picture = null;
      this.drawingHolder.replaceChildren(
        h('div', { class: 'problems', role: 'alert' }, [
          h('p', {}, [`${path} has problems, so Aerie cannot draw it:`]),
          h(
            'ul',
            {},
            result.diagnostics
              .filter((each) => each.severity === 'error')
              .map((each) =>
                h('li', {}, [
                  `Line ${String(each.line)}, column ${String(each.column)}: ${each.message}`,
                ]),
              ),
          ),
        ]),
      );
      this.renderControls(path);
      this.root.dataset['ready'] = 'true';
      return;
    }
    const semantics = new Semantics(result.model);
    this.opened = { path, semantics, layouter: new Layouter(semantics, this.engine) };
    this.zoomPreset = 'default';
    this.change(defaultPicture(semantics));
  }

  /** Sets the picture, normalised, and draws it. */
  private change(picture: Picture): void {
    if (this.opened === null) return;
    this.picture = normalisePicture(this.opened.semantics, picture).picture;
    this.renderControls(this.opened.path);
    void this.draw();
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
    const sections: Node[] = [
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
        h('span', { class: at === crumbs.length - 1 ? 'here' : '' }, [each]),
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
