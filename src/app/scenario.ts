// Scenario playback on the page (docs/spec/interaction.md, INT-601 to INT-606): the side panel of a
// playing scenario, with its controls and numbered step list, the caption bar's words, and the
// autoplay clock. The viewer owns the picture; this module shows a playing scenario and reports what
// the reader asks for.
import type { Id } from '../lines/index.ts';
import { proseFor, type Semantics } from '../model/index.ts';
import { MOTION, scenarioTitle } from '../render/index.ts';
import { h, prose } from './dom.ts';

/** What the scenario panel's controls do. */
export interface ScenarioActions {
  /** INT-605: one step back. */
  back(): void;
  /** INT-605: one step forward. */
  forward(): void;
  /** INT-605: Play or Pause. */
  playOrPause(): void;
  /** INT-605: ends the scenario. */
  done(): void;
  /** INT-604: on the map (false) or as lanes (true). */
  lanes(on: boolean): void;
  /** INT-602: jumps to a step, from 1. */
  step(step: number): void;
}

/** Where a playing scenario is, and whether it plays by itself. */
export interface Playback {
  step: number;
  lanes: boolean;
  /** True while Play advances the steps (INT-605). */
  running: boolean;
}

/** INT-603: the caption bar: the step count and the step's caption for the current audience. */
export interface Caption {
  /** "9/14". */
  count: string;
  text: string;
  /** MODEL-105: an audience that reads code reads captions in monospace. */
  code: boolean;
}

/** INT-603: the caption bar's words at step `step` of a scenario, for an audience. */
export function captionOf(semantics: Semantics, scenario: Id, step: number, audience: Id): Caption {
  const steps = semantics.steps(scenario, audience);
  const here = steps[step - 1];
  return {
    count: `Step ${String(step)} of ${String(steps.length)}`,
    text: here?.caption ?? '',
    code: semantics.audience(audience).code,
  };
}

/** The caption's text as nodes, its `code` and `**bold**` spans kept (INT-603). */
export function captionText(caption: Caption): HTMLElement {
  return h('p', { class: caption.code ? 'caption-text code' : 'caption-text' }, [
    h('span', { class: 'count' }, [caption.count]),
    ...prose(caption.text),
  ]);
}

/**
 * INT-602: the side panel of a playing scenario, worded for one audience. It is built once and
 * then changed in place as the scenario moves, so the panel neither flickers nor loses the
 * reader's place or keyboard focus at every step. Another audience builds another panel, whose
 * wording swaps in (INT-102).
 */
export class ScenarioPanel {
  readonly element: HTMLElement;
  readonly semantics: Semantics;
  readonly scenario: Id;
  readonly audience: Id;
  private readonly list: HTMLElement;
  private readonly items: HTMLElement[];
  private readonly back: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private readonly play: HTMLButtonElement;
  private readonly onMap: HTMLButtonElement;
  private readonly asLanes: HTMLButtonElement;
  private shownStep = 0;

  constructor(semantics: Semantics, scenario: Id, audience: Id, actions: ScenarioActions) {
    this.semantics = semantics;
    this.scenario = scenario;
    this.audience = audience;
    const code = semantics.audience(audience).code;
    const about = proseFor(semantics.scenario(scenario).about, audience);
    const button = (
      control: string,
      text: string,
      run: () => void,
      className = 'tool',
    ): HTMLButtonElement =>
      h('button', { type: 'button', class: className, 'data-control': control, onclick: run }, [
        text,
      ]);
    this.back = button('back', 'Back', () => {
      actions.back();
    });
    this.play = button(
      'play',
      'Play',
      () => {
        actions.playOrPause();
      },
      'tool play-button',
    );
    this.next = button('next', 'Next', () => {
      actions.forward();
    });
    this.onMap = button(
      'map',
      'On the diagram',
      () => {
        actions.lanes(false);
      },
      'mode',
    );
    this.asLanes = button(
      'lanes',
      'As lanes',
      () => {
        actions.lanes(true);
      },
      'mode',
    );
    const steps = semantics.steps(scenario, audience);
    this.items = steps.map((step) =>
      h('li', { class: step.role, 'data-step': step.number }, [
        h(
          'button',
          {
            type: 'button',
            class: 'step-choice',
            'data-step': step.number,
            onclick: () => {
              actions.step(step.number);
            },
          },
          [
            h('span', { class: 'number', 'aria-hidden': 'true' }, [String(step.number)]),
            h('span', { class: 'what' }, [
              h('span', { class: 'ends' }, [
                `${semantics.name(step.subject, audience)} to ${semantics.name(step.object, audience)}`,
              ]),
              h('span', { class: code ? 'caption code' : 'caption' }, prose(step.caption)),
            ]),
          ],
        ),
      ]),
    );
    this.list = h('ol', { class: 'steps', 'aria-label': 'Steps' }, this.items);
    this.element = h('div', { class: 'panel-content scenario' }, [
      h('p', { class: 'kicker' }, ['Scenario']),
      h('h1', { tabindex: -1 }, [scenarioTitle(semantics, scenario, audience)]),
      ...(about === null
        ? []
        : about.split(/\n\n+/).map((para) => h('p', { class: 'lead' }, prose(para)))),
      // INT-602: the controls stay in view while the list scrolls.
      h('div', { class: 'player' }, [
        h('div', { class: 'controls', role: 'group', 'aria-label': 'Play the scenario' }, [
          this.back,
          this.play,
          this.next,
          button('done', 'End', () => {
            actions.done();
          }),
        ]),
        h('div', { class: 'modes', role: 'group', 'aria-label': 'Show the scenario' }, [
          this.onMap,
          this.asLanes,
        ]),
      ]),
      this.list,
    ]);
  }

  /** True when this panel shows `scenario` for `audience` of the model `semantics` describes. */
  shows(semantics: Semantics, scenario: Id, audience: Id): boolean {
    return this.semantics === semantics && this.scenario === scenario && this.audience === audience;
  }

  /**
   * Marks the current step (shaded), the earlier ones (done) and the controls' state. A step that
   * changed is scrolled into the list's view, within the panel only.
   */
  update(playback: Playback): void {
    const count = this.items.length;
    this.items.forEach((item, index) => {
      const number = index + 1;
      item.classList.toggle('now', number === playback.step);
      item.classList.toggle('done', number < playback.step);
      const choice = item.querySelector(':scope > button');
      if (number === playback.step) choice?.setAttribute('aria-current', 'step');
      else choice?.removeAttribute('aria-current');
    });
    this.back.setAttribute('aria-disabled', playback.step <= 1 ? 'true' : 'false');
    this.next.setAttribute('aria-disabled', playback.step >= count ? 'true' : 'false');
    this.play.textContent = playback.running ? 'Pause' : 'Play';
    this.play.setAttribute('aria-pressed', playback.running ? 'true' : 'false');
    this.onMap.setAttribute('aria-pressed', playback.lanes ? 'false' : 'true');
    this.asLanes.setAttribute('aria-pressed', playback.lanes ? 'true' : 'false');
    if (playback.step !== this.shownStep && this.element.isConnected) {
      this.shownStep = playback.step;
      this.reveal(this.items[playback.step - 1]);
    }
  }

  /** Scrolls the panel just enough to show a step below the controls that stay in view. */
  private reveal(item: HTMLElement | undefined): void {
    const panel = this.element.parentElement;
    if (item === undefined || panel === null || !this.element.isConnected) return;
    const player = this.element.querySelector<HTMLElement>(':scope > .player');
    const view = panel.getBoundingClientRect();
    const top = view.top + (player?.offsetHeight ?? 0);
    const at = item.getBoundingClientRect();
    if (at.top < top) panel.scrollTop -= top - at.top;
    else if (at.bottom > view.bottom) panel.scrollTop += at.bottom - view.bottom;
  }

  /** The control or step that has the keyboard focus, so a new panel can give it back. */
  focusKey(): string | null {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !this.element.contains(active)) return null;
    const control = active.dataset['control'];
    if (control !== undefined) return `[data-control="${control}"]`;
    const step = active.dataset['step'];
    return step === undefined ? null : `button[data-step="${step}"]`;
  }

  /** Gives the focus to the control or step `focusKey` named on another panel. */
  focus(key: string): void {
    this.element.querySelector<HTMLElement>(key)?.focus({ preventScroll: true });
  }
}

/**
 * INT-605: Play advances one step every 2.4 s (LOOK-901) until the last step, then stops. The
 * clock only ticks; the viewer decides what a tick does.
 */
export class Autoplay {
  private timer: number | null = null;
  private readonly tick: () => void;

  constructor(tick: () => void) {
    this.tick = tick;
  }

  get running(): boolean {
    return this.timer !== null;
  }

  /** Starts the clock, or restarts it so the next step comes a whole pace from now. */
  start(): void {
    this.stop();
    this.timer = window.setInterval(() => {
      this.tick();
    }, MOTION.autoplay);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }
}
