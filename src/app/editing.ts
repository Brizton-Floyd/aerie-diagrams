// The "Edit" button of the live split editor (docs/spec/interaction.md, INT-801). The editor itself
// is in split.ts, loaded the first time the author presses the button.
import { h } from './dom.ts';
import type { Session } from './split.ts';
import type { Viewer } from './viewer.ts';

/** INT-801: adds the "Edit" button to the top bar; while editing it reads "Done". */
export function addEditor(viewer: Viewer): void {
  let session: Session | null = null;
  const button = h('button', {
    type: 'button',
    class: 'tool edit',
    'aria-pressed': 'false',
    onclick: () => {
      if (session !== null) {
        session.close();
        session = null;
        show();
        return;
      }
      button.disabled = true;
      void import('./split.ts')
        .then((split) => {
          session = new split.Session(viewer);
        })
        .catch(() => {
          viewer.say('Aerie could not load the editor. Reload the page and try again.');
        })
        .finally(() => {
          button.disabled = false;
          show();
        });
    },
  });
  const show = (): void => {
    button.textContent = session === null ? 'Edit' : 'Done';
    button.setAttribute('aria-pressed', String(session !== null));
  };
  button.textContent = 'Edit';
  viewer.addTool(button);
}
