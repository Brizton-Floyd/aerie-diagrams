// The page's entry point: Aerie's bundled fonts (LOOK-101, served with the page, never fetched from
// a font service), the Signal stylesheet and the page chrome, then the viewer: with the split
// editor (INT-801), or following the author's file when `aerie watch` serves the page (INT-851).
import { installAppearance } from './app/appearance.ts';
import { workerEngine } from './layout/elk/worker.ts';
import { addExport } from './app/exporting.ts';
import { addStaticExport } from './app/static-export.ts';
import { addEditor } from './app/editing.ts';
import { Viewer, start } from './app/viewer.ts';
import { follow, watchAddress } from './app/watching.ts';

installAppearance();

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  const address = watchAddress();
  if (address === null) {
    const viewer = start(app, workerEngine());
    addStaticExport(viewer);
    addEditor(viewer);
    addExport(viewer);
  } else {
    const viewer = new Viewer(app, { watching: true, engine: workerEngine() });
    addStaticExport(viewer);
    addExport(viewer);
    follow(viewer, address);
  }
}
