// The page's entry point: Aerie's bundled fonts (LOOK-101, served with the page, never fetched from
// a font service), the Signal stylesheet and the page chrome, then the viewer: with the split
// editor (INT-801), or following the author's file when `aerie watch` serves the page (INT-851).
import '@fontsource/inter/400.css';
import '@fontsource/inter/400-italic.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/400-italic.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/500-italic.css';
import { signalStyle } from './render/index.ts';
import './app/page.css';
import { addEditor } from './app/editing.ts';
import { Viewer, start } from './app/viewer.ts';
import { follow, watchAddress } from './app/watching.ts';

const style = document.createElement('style');
style.id = 'aerie-signal';
style.textContent = signalStyle();
document.head.append(style);

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  const address = watchAddress();
  if (address === null) addEditor(start(app));
  else follow(new Viewer(app, { watching: true }), address);
}
