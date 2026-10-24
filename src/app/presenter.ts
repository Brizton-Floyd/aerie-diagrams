// Presenter mode on the page (docs/spec/interaction.md, INT-701 to INT-707): the narration bar's
// words and the on-screen Back, Next and Exit, which hide while the pointer is still. The viewer
// owns the picture and full screen; this module shows a presented walkthrough and reports what the
// presenter asks for.
import type { Id } from '../lines/index.ts';
import { wordsFor, type Picture, type Semantics } from '../model/index.ts';
import { MOTION, scenarioTitle } from '../render/index.ts';
import { h, prose } from './dom.ts';
import { captionOf } from './scenario.ts';

/** INT-706: what the narration bar says under the narration on the last step. */
export const END_OF_WALKTHROUGH =
  'That is the end of the tour. Press Exit, or Esc, to explore on your own.';

/** INT-701: the narration bar of one walkthrough step, for the current audience. */
export interface Narration {
  /** "3 / 8": the step and the number of steps. */
  count: string;
  /** The walkthrough's title. */
  title: string;
  /** MODEL-506 and INT-705: the narration, or the view's title or the scenario step's caption. */
  text: string;
  /** LOOK-102: an audience that reads code reads the narration in monospace. */
  code: boolean;
  /** INT-706: true on the last step. */
  end: boolean;
  /** Inside a scenario step, the scenario's title and where it is ("9/14"); otherwise null. */
  scenario: { title: string; count: string } | null;
}

/** The narration bar's words for a picture that presents a walkthrough, or null for any other. */
export function narrationOf(semantics: Semantics, picture: Picture): Narration | null {
  const { activity, audience } = picture;
  if (activity.kind !== 'presenting') return null;
  const pictures = semantics.walkPictures(activity.walkthrough);
  const scenario = pictures[activity.step - 1]?.scenario ?? null;
  const inside =
    scenario === null || activity.scenarioStep === null
      ? null
      : captionOf(semantics, scenario.id, activity.scenarioStep, audience);
  const told = semantics.narration(activity.walkthrough, activity.step, audience);
  // INT-705: a step without narration shows its view's title, or the scenario step's caption.
  const text = told ?? inside?.text ?? semantics.viewTitle(picture.view, audience);
  return {
    count: `${String(activity.step)} of ${String(pictures.length)}`,
    title: walkthroughTitle(semantics, activity.walkthrough, audience),
    text,
    code: semantics.audience(audience).code,
    end: activity.step >= pictures.length,
    scenario:
      scenario === null || inside === null
        ? null
        : { title: scenarioTitle(semantics, scenario.id, audience), count: inside.count },
  };
}

/** A walkthrough's title for an audience. */
export function walkthroughTitle(semantics: Semantics, walkthrough: Id, audience: Id): string {
  return wordsFor(semantics.walkthrough(walkthrough).title, audience) ?? walkthrough;
}

/** The narration bar's content: the count and title, the narration, and the end of the walk. */
export function narrationContent(narration: Narration): HTMLElement {
  return h('div', { class: 'narration' }, [
    h('p', { class: 'narration-meta' }, [
      h('span', { class: 'count' }, [narration.count]),
      h('span', { class: 'title' }, [narration.title]),
      narration.scenario === null
        ? null
        : h('span', { class: 'scenario' }, [
            `${narration.scenario.title} `,
            h('span', { class: 'scenario-count' }, [narration.scenario.count]),
          ]),
    ]),
    h(
      'p',
      { class: narration.code ? 'narration-text code' : 'narration-text' },
      prose(narration.text),
    ),
    narration.end ? h('p', { class: 'narration-end' }, [END_OF_WALKTHROUGH]) : null,
  ]);
}

/** What the presenter's on-screen controls do. */
export interface PresenterActions {
  /** INT-703: one step back. */
  back(): void;
  /** INT-703: one step forward. */
  forward(): void;
  /** INT-703: ends the presentation. */
  exit(): void;
  /** INT-106: words the presentation for the next audience, round to the first. */
  wording(): void;
}

/**
 * INT-701: Back, Next and Exit at the bottom right of the stage. They hide after the pointer has
 * been still for a while (LOOK-901) and come back when it moves; a control with the keyboard focus
 * stays in view (the stylesheet keeps it).
 */
export class PresenterControls {
  readonly element: HTMLElement;
  private readonly back: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private readonly wordingButton: HTMLButtonElement;
  private timer = 0;
  private active = false;

  constructor(actions: PresenterActions) {
    const button = (control: string, text: string, run: () => void): HTMLButtonElement =>
      h('button', { type: 'button', class: 'tool', 'data-control': control, onclick: run }, [text]);
    this.back = button('back', 'Back', () => {
      actions.back();
    });
    this.next = button('next', 'Next', () => {
      actions.forward();
    });
    this.wordingButton = button('wording', '', () => {
      actions.wording();
    });
    this.element = h(
      'div',
      { class: 'presenter-controls', role: 'group', 'aria-label': 'Present', hidden: true },
      [
        this.wordingButton,
        this.back,
        this.next,
        button('exit', 'Exit', () => {
          actions.exit();
        }),
      ],
    );
    document.addEventListener('pointermove', () => {
      if (this.active) this.wake();
    });
  }

  /**
   * Shows the controls for a step, or hides them with null when nothing is presented. Back and
   * Next say when they would do nothing (INT-706).
   */
  update(at: { first: boolean; last: boolean; wording: string } | null): void {
    const was = this.active;
    this.active = at !== null;
    this.element.hidden = at === null;
    if (at === null) {
      window.clearTimeout(this.timer);
      return;
    }
    this.back.setAttribute('aria-disabled', at.first ? 'true' : 'false');
    this.next.setAttribute('aria-disabled', at.last ? 'true' : 'false');
    this.wordingButton.textContent = at.wording;
    this.wordingButton.title = 'Word the presentation for the next audience (keys 1 to 6)';
    if (!was) this.wake();
  }

  /** Brings the controls back and hides them again once the pointer has been still long enough. */
  private wake(): void {
    this.element.classList.remove('idle');
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.element.classList.add('idle');
    }, MOTION.presenterIdle);
  }
}
