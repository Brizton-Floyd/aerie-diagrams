// The page in watch mode (docs/spec/interaction.md, INT-851 to INT-855): `aerie watch` serves it and
// sends the author's file each time it is saved; the page updates exactly as the split editor does,
// and shows the error list over the stage while the file has errors.
import { h } from './dom.ts';
import { Live, errorList, errorText, type Checked } from './live.ts';
import type { Viewer } from './viewer.ts';

/** What the watch server sends a page: the file's text, or why it cannot be read (INT-854). */
export type WatchEvent = { file: string; source: string } | { file: string; problem: string };

/** The meta tag the watch server adds to the page, naming the address of its events. */
export const WATCH_META = 'aerie-watch';

/** The address of the watch server's events, when this page was served by one. */
export function watchAddress(): string | null {
  return document.querySelector<HTMLMetaElement>(`meta[name="${WATCH_META}"]`)?.content ?? null;
}

/** Follows the author's file: every message from the server is a new version or a problem. */
export function follow(viewer: Viewer, address: string): void {
  let opened = false;
  const live = new Live((checked: Checked) => {
    viewer.revise(checked);
    const errors = errorList(checked.diagnostics).filter((found) => found.severity === 'error');
    // INT-003: without an earlier version the stage itself lists the errors.
    viewer.cover(
      errors.length === 0 || checked.shown === null
        ? null
        : h('div', { class: 'problems', role: 'alert' }, [
            h(
              'ul',
              {},
              errors.map((found) => h('li', {}, [errorText(found)])),
            ),
          ]),
    );
  });
  const events = new EventSource(address);
  events.addEventListener('message', (message: MessageEvent<string>) => {
    const event = JSON.parse(message.data) as WatchEvent;
    if ('problem' in event) {
      // INT-854: the page keeps the last picture and says why the file cannot be read.
      viewer.say(event.problem);
      return;
    }
    if (opened) {
      live.now(event.source);
      return;
    }
    opened = true;
    // A reload keeps the reader's picture: the address holds it (INT-501).
    live.seed(viewer.open(event.file, event.source, location.hash));
  });
}
