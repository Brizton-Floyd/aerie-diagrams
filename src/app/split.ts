// One open split editor (docs/spec/interaction.md, INT-801 to INT-808): the model's Lines source
// where the sidebar was, the diagram updating a moment after the author stops typing, and while the
// text has errors, the last version without them. Loaded when the author first presses "Edit", so
// readers never download the text editor.
import { format, type Diagnostic } from '../lines/index.ts';
import { h } from './dom.ts';
import { downloadModel } from './download.ts';
import { LinesEditor } from './editor.ts';
import { Live, errorList, errorText, type Checked } from './live.ts';
import type { Viewer } from './viewer.ts';

/** INT-801: the editor's share of the window, and the least it may have. */
const SHARE = 0.4;
const NARROWEST = 360;
/** What the divider leaves the stage and the side panel at least (LOOK-801). */
const STAGE_LEAST = 240;
const PANEL = 344;

/** INT-808: the author's copy is kept on this device, one per model. */
const draftKey = (path: string): string => `aerie.draft.${path}`;

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, text: string | null): void {
  try {
    if (text === null) localStorage.removeItem(key);
    else localStorage.setItem(key, text);
  } catch {
    // Storage may be off; the copy then lasts while the page is open.
  }
}

/** One open split editor. */
export class Session {
  readonly pane: HTMLElement;
  private readonly viewer: Viewer;
  private readonly path: string;
  private readonly published: string;
  private readonly editor: LinesEditor;
  private readonly live: Live;
  private readonly errors: HTMLElement;
  private readonly discard: HTMLButtonElement;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    const { path, source } = viewer.published;
    this.path = path;
    this.published = source;
    const text = stored(draftKey(path)) ?? source;
    this.live = new Live((checked) => {
      this.checked(checked);
    });
    this.errors = h('ol', { class: 'errors', 'aria-label': 'Problems' });
    this.discard = h(
      'button',
      {
        type: 'button',
        class: 'tool',
        onclick: () => {
          store(draftKey(this.path), null);
          this.editor.replace(this.published);
          this.live.now(this.published);
        },
      },
      ['Discard changes'],
    );
    const host = h('div', { class: 'editor-host' });
    const divider = h('div', {
      class: 'divider',
      role: 'separator',
      'aria-orientation': 'vertical',
      'aria-label': 'Editor width',
    });
    this.pane = h('section', { class: 'editor-pane', 'aria-label': 'Split editor' }, [
      h('div', { class: 'editor-bar' }, [
        h(
          'button',
          {
            type: 'button',
            class: 'tool',
            onclick: () => {
              this.format();
            },
          },
          ['Format'],
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'tool',
            onclick: () => {
              this.download();
            },
          },
          ['Download'],
        ),
        this.discard,
      ]),
      host,
      this.errors,
      divider,
    ]);
    this.editor = new LinesEditor(host, {
      text,
      onChange: (changed) => {
        this.viewer.changedSource(changed);
        store(draftKey(this.path), changed === this.published ? null : changed);
        this.discard.disabled = changed === this.published;
        this.live.edit(changed);
      },
      onFormat: () => {
        this.format();
      },
    });
    this.discard.disabled = text === this.published;
    this.drag(divider);
    viewer.showEditor(this.pane);
    this.width(Math.max(NARROWEST, innerWidth * SHARE));
    // The diagram shows the author's copy from the start, and the published model when there is none.
    this.live.now(text);
  }

  private checked(checked: Checked): void {
    this.viewer.revise(checked);
    this.editor.show(checked.diagnostics);
    this.list(checked.diagnostics);
  }

  /** INT-806: the error list below the editor; choosing an entry moves the cursor to it. */
  private list(diagnostics: readonly Diagnostic[]): void {
    this.errors.replaceChildren(
      ...errorList(diagnostics).map((found) =>
        h('li', { class: found.severity }, [
          h(
            'button',
            {
              type: 'button',
              onclick: () => {
                this.editor.moveTo(found);
              },
            },
            [errorText(found)],
          ),
        ]),
      ),
    );
  }

  /** INT-807: the formatter changes only spacing, and leaves a file it cannot read as it is. */
  private format(): void {
    const result = format(this.editor.text);
    if (result.diagnostics.length > 0 || !result.changed) return;
    this.editor.replace(result.text);
    this.live.now(result.text);
  }

  /** INT-808: saves the author's copy as a `.aerie` file. */
  private download(): void {
    downloadModel(this.path, this.editor.text);
  }

  /** INT-801: the divider between the editor and the diagram, dragged with the pointer. */
  private drag(divider: HTMLElement): void {
    divider.addEventListener('pointerdown', (down) => {
      down.preventDefault();
      divider.setPointerCapture(down.pointerId);
      const left = this.pane.getBoundingClientRect().left;
      const move = (event: PointerEvent): void => {
        this.width(event.clientX - left);
      };
      const up = (): void => {
        divider.removeEventListener('pointermove', move);
        divider.removeEventListener('pointerup', up);
        divider.removeEventListener('pointercancel', up);
      };
      divider.addEventListener('pointermove', move);
      divider.addEventListener('pointerup', up);
      divider.addEventListener('pointercancel', up);
    });
  }

  private width(wanted: number): void {
    const widest = Math.max(NARROWEST, innerWidth - PANEL - STAGE_LEAST);
    const width = Math.round(Math.min(widest, Math.max(NARROWEST, wanted)));
    this.pane.parentElement?.style.setProperty('--editor-width', `${String(width)}px`);
  }

  /** "Done": the diagram catches up with the text, and the sidebar comes back. */
  close(): void {
    this.live.flush();
    this.editor.destroy();
    this.pane.parentElement?.style.removeProperty('--editor-width');
    this.viewer.showEditor(null);
  }
}
