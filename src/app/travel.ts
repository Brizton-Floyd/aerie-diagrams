// Back and Forward on the page (docs/spec/interaction.md, INT-553 and INT-555; LOOK-808): the two
// buttons at the stage's top left and the list of recent visits beside them. The viewer owns the
// visits and the browser's history; this module shows them and reports what the reader asks for.
import { h } from './dom.ts';
import { RECENT } from './visits.ts';

/** What the reader asks of the controls. */
export interface TravelActions {
  /** INT-553: one visit back. */
  back(): void;
  /** INT-553: one visit forward. */
  forward(): void;
  /** INT-555: straight to the visit at a place in the list. */
  go(at: number): void;
}

/** What the controls show: whether Back and Forward lead anywhere, and the recent visits. */
export interface TravelView {
  canBack: boolean;
  canForward: boolean;
  /** The recent visits, oldest first: each one's place in the list and its name. */
  recent: { at: number; name: string }[];
  /** The place of the current visit. */
  at: number;
}

/**
 * LOOK-808: the fixed sizes the controls take, so the stage can tell how many names fit beside the
 * camera buttons: the two buttons and the gap after them, one name and the separator before it, and
 * the stage's width the controls leave alone (its margins, the camera buttons and a gap).
 */
export const TRAVEL = { buttons: 86, name: 112, separator: 14, kept: 180 } as const;

/** INT-555: how many names fit on a stage of this width, up to RECENT. */
export function namesThatFit(stageWidth: number): number {
  const room = stageWidth - TRAVEL.kept - TRAVEL.buttons;
  const fit = Math.floor((room + TRAVEL.separator) / (TRAVEL.name + TRAVEL.separator));
  return Math.max(0, Math.min(RECENT, fit));
}

export class TravelControls {
  readonly element: HTMLElement;
  private readonly back: HTMLButtonElement;
  private readonly forward: HTMLButtonElement;
  private readonly list: HTMLOListElement;
  private readonly actions: TravelActions;

  constructor(actions: TravelActions) {
    this.actions = actions;
    const button = (control: string, label: string, text: string, run: () => void) =>
      h(
        'button',
        {
          type: 'button',
          class: 'cam',
          'data-control': control,
          'aria-label': label,
          title: `${label} (Alt+${control === 'back' ? 'Left' : 'Right'})`,
          'aria-disabled': 'true',
          onclick: () => {
            if (control === 'back' ? this.canBack : this.canForward) run();
          },
        },
        [text],
      );
    this.back = button('back', 'Back', '‹', () => {
      actions.back();
    });
    this.forward = button('forward', 'Forward', '›', () => {
      actions.forward();
    });
    this.list = h('ol', { class: 'recent', 'aria-label': 'Recent visits' });
    this.element = h('div', { class: 'travel', role: 'group', 'aria-label': 'Visits' }, [
      this.back,
      this.forward,
      this.list,
    ]);
  }

  private get canBack(): boolean {
    return this.back.getAttribute('aria-disabled') === 'false';
  }

  private get canForward(): boolean {
    return this.forward.getAttribute('aria-disabled') === 'false';
  }

  /** Shows where the reader is among their visits; the list hides while there is only one. */
  update(view: TravelView): void {
    this.back.setAttribute('aria-disabled', view.canBack ? 'false' : 'true');
    this.forward.setAttribute('aria-disabled', view.canForward ? 'false' : 'true');
    const hadFocus = this.list.contains(document.activeElement);
    this.list.replaceChildren(
      ...view.recent.map(({ at, name }) =>
        h('li', {}, [
          h(
            'button',
            {
              type: 'button',
              'data-visit': at,
              title: name,
              'aria-current': at === view.at ? 'true' : null,
              onclick: () => {
                if (at !== view.at) this.actions.go(at);
              },
            },
            [name],
          ),
        ]),
      ),
    );
    this.list.hidden = view.recent.length < 2;
    // A reader choosing from the list with the keyboard stays on the visit they reached.
    if (hadFocus) this.list.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
  }
}
