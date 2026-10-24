// Static scenario overview (INT-620 to INT-623). Playback retains its own controls and panel.
import type { Picture, Semantics } from '../model/index.ts';
import type { Id } from '../lines/index.ts';
import { scenarioTitle } from '../render/index.ts';
import { h, prose } from './dom.ts';

export interface FlowActions {
  show(scenario: Id, step: number): void;
  play(scenario: Id, step: number): void;
  clear(): void;
}

export function flowPanel(semantics: Semantics, picture: Picture, actions: FlowActions): Node[] {
  const { activity, audience } = picture;
  if (activity.kind !== 'overview') return [];
  const steps = semantics.overviewSteps(activity.scenario, audience);
  const staged = semantics.scenario(activity.scenario).stages !== undefined;
  const current = steps[activity.step - 1];
  return [
    h('p', { class: 'kicker' }, ['Flow overview']),
    h('h1', { tabindex: -1 }, [scenarioTitle(semantics, activity.scenario, audience)]),
    h('p', {}, [
      staged
        ? 'The main flow at a glance. Choose a number to learn about that stage.'
        : 'Every numbered step is visible. Choose a number to see what happens there.',
    ]),
    h('label', { class: 'flow-choice' }, [
      'Follow a flow',
      h(
        'select',
        {
          'aria-label': 'Follow a flow',
          'data-flow-action': 'choose',
          onchange: (event) => {
            actions.show((event.target as HTMLSelectElement).value, 1);
          },
        },
        semantics.model.scenarios.map((scenario) =>
          h(
            'option',
            {
              value: scenario.id,
              selected: scenario.id === activity.scenario,
            },
            [scenarioTitle(semantics, scenario.id, audience)],
          ),
        ),
      ),
    ]),
    h('section', { class: 'flow-caption', 'aria-live': 'polite', 'aria-atomic': 'true' }, [
      h('p', { class: 'kicker' }, [
        `${staged ? 'Stage' : 'Step'} ${String(activity.step)} of ${String(steps.length)}`,
      ]),
      h('h2', {}, [current?.sentence]),
      ...(current?.about?.split('\n\n').map((text) => h('p', {}, prose(text))) ?? []),
    ]),
    h('div', { class: 'flow-actions' }, [
      h(
        'button',
        {
          type: 'button',
          class: 'tool',
          'data-flow-action': 'play',
          onclick: () => {
            actions.play(activity.scenario, activity.step);
          },
        },
        [staged ? 'Follow the full flow' : 'Follow the steps'],
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'tool',
          'data-flow-action': 'clear',
          onclick: () => {
            actions.clear();
          },
        },
        ['Clear flow'],
      ),
    ]),
    h(
      'ol',
      { class: 'flow-steps' },
      steps.map((step) =>
        h('li', {}, [
          h(
            'button',
            {
              type: 'button',
              class: 'tool',
              'data-flow-step': step.number,
              'aria-current': step.number === activity.step ? 'step' : null,
              onclick: () => {
                actions.show(activity.scenario, step.number);
              },
            },
            [`${String(step.number)}. ${step.sentence}`],
          ),
        ]),
      ),
    ),
  ];
}
