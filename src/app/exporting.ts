import runtimeUrl from '../../.portable/reader.txt?url';
import { h } from './dom.ts';
import { portableHtml } from './portable-html.ts';
import type { Viewer } from './viewer.ts';

let runtime: Promise<string> | null = null;

/** INT-1023: bundle loading is deferred until export and a failed load can be retried. */
async function readerRuntime(): Promise<string> {
  runtime ??= fetch(runtimeUrl)
    .then(async (response) => {
      if (!response.ok) throw new Error('Reader unavailable');
      const text = await response.text();
      if (!text.startsWith('// Aerie portable reader v1\n')) throw new Error('Reader unavailable');
      return text;
    })
    .catch((error: unknown) => {
      runtime = null;
      throw error;
    });
  return runtime;
}

/** INT-1021: publish a complete interactive snapshot as one downloadable HTML file. */
export function addExport(viewer: Viewer): void {
  const button = h(
    'button',
    {
      type: 'button',
      class: 'tool export-html',
      title:
        'Download an interactive HTML file containing the whole model and all audience wording',
      onclick: () => {
        const snapshot = viewer.exportSnapshot();
        if (snapshot === null) return;
        button.disabled = true;
        button.textContent = 'Exporting';
        void readerRuntime()
          .then((reader) => {
            const url = URL.createObjectURL(
              new Blob([portableHtml(snapshot, reader)], { type: 'text/html;charset=utf-8' }),
            );
            const base =
              snapshot.path
                .split('/')
                .pop()
                ?.replace(/\.aerie$/, '') ?? '';
            const link = h('a', {
              href: url,
              download: `${base === '' ? 'model' : base}.html`,
            });
            document.body.append(link);
            link.click();
            link.remove();
            window.setTimeout(() => {
              URL.revokeObjectURL(url);
            }, 0);
            viewer.say('HTML exported. It includes the whole model and every audience’s wording.');
          })
          .catch(() => {
            viewer.say('Aerie could not prepare the HTML file. Try exporting again.');
          })
          .finally(() => {
            button.disabled = false;
            button.textContent = 'Export HTML';
          });
      },
    },
    ['Export HTML'],
  );
  viewer.addTool(button);
}
