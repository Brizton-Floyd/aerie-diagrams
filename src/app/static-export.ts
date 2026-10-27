// Host-only PNG/PDF export: the portable reader does not load these encoders or their fonts.
import type { ExportPanel } from './export-panel.ts';
import { h } from './dom.ts';
import type { Viewer } from './viewer.ts';

/** EXPORT-007: lazily open an isolated export session without changing the main picture. */
export function addStaticExport(viewer: Viewer): void {
  let panel: ExportPanel | null = null;
  const button = h(
    'button',
    {
      type: 'button',
      class: 'tool export',
      title: 'Export this view as PNG or PDF',
      onclick: () => {
        void show();
      },
    },
    ['Export'],
  );
  async function show(): Promise<void> {
    button.disabled = true;
    try {
      const { ExportPanel } = await import('./export-panel.ts');
      const snapshot = viewer.staticExportSnapshot();
      if (snapshot === null) {
        viewer.say(
          'Fix the model errors before exporting. There is no valid diagram to export yet.',
        );
        return;
      }
      if (panel === null) {
        panel = new ExportPanel();
        panel.element.addEventListener('close', () => {
          button.focus();
        });
        viewer.addDialog(panel.element);
      }
      panel.show(snapshot);
    } catch {
      viewer.say('Could not load the exporter. Reload the page and try again.');
    } finally {
      button.disabled = false;
    }
  }
  viewer.addTool(button);
}
