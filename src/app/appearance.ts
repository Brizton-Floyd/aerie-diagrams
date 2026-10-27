import '@fontsource/inter/400.css';
import '@fontsource/inter/400-italic.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/400-italic.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/500-italic.css';
import './page.css';
import './documentation.css';
import { signalStyle } from '../render/index.ts';

/** Install the same Signal stylesheet for the authoring page and the portable reader. */
export function installAppearance(): void {
  const style = document.createElement('style');
  style.id = 'aerie-signal';
  style.textContent = signalStyle();
  document.head.append(style);
}
