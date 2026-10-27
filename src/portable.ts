import { inlineWorkerEngine } from './layout/elk/inline-worker.ts';
import { installAppearance } from './app/appearance.ts';
import type { PortableSnapshot } from './app/portable-html.ts';
import { Viewer } from './app/viewer.ts';

installAppearance();
const payload = document.querySelector('#aerie-export')?.textContent;
const root = document.querySelector<HTMLElement>('#app');
if (root && payload) {
  const snapshot = JSON.parse(payload) as PortableSnapshot;
  const engine = inlineWorkerEngine();
  const viewer = new Viewer(root, { engine, portable: true, theme: snapshot.theme });
  viewer.open(snapshot.path, snapshot.source, location.hash || snapshot.fragment);
}
