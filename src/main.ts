// The page's entry point: Aerie's bundled fonts (LOOK-101, served with the page, never fetched from
// a font service), the Contour stylesheet and the page chrome, then the viewer: with the split
// editor (INT-801), or following the author's file when `aerie watch` serves the page (INT-851).
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/source-serif-4/400.css';
import '@fontsource/source-serif-4/400-italic.css';
import '@fontsource/source-serif-4/600.css';
import '@fontsource/source-code-pro/400.css';
import { contourStyle } from './render/index.ts';
import './app/page.css';
import { addEditor } from './app/editing.ts';
import { Viewer, start } from './app/viewer.ts';
import { follow, watchAddress } from './app/watching.ts';

const style = document.createElement('style');
style.id = 'aerie-contour';
style.textContent = contourStyle();
document.head.append(style);

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  const address = watchAddress();
  if (address === null) addEditor(start(app));
  else follow(new Viewer(app, { watching: true }), address);
}
