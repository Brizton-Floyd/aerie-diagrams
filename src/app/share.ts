import { h } from './dom.ts';
import { downloadModel } from './download.ts';

/** INT-508: explains file sharing when an address cannot carry the displayed model. */
export class ShareDialog {
  readonly element: HTMLDialogElement;
  private model: { path: string; source: string } | null = null;

  constructor() {
    this.element = h(
      'dialog',
      {
        class: 'share-dialog',
        'aria-labelledby': 'share-model-title',
        'aria-describedby': 'share-model-description',
        // Escape and Space belong to the dialog, not the flow or playback behind it.
        onkeydown: (event) => {
          event.stopPropagation();
        },
        onclose: () => {
          this.model = null;
        },
      },
      [
        h('h1', { id: 'share-model-title' }, ['Share this model']),
        h('p', { id: 'share-model-description' }, [
          "This model is on your device. A link won't include it. Download the .aerie file and send it to the person you want to share it with.",
        ]),
        h('div', { class: 'share-actions' }, [
          h(
            'button',
            {
              type: 'button',
              class: 'tool share-download',
              autofocus: true,
              onclick: () => {
                if (this.model !== null) downloadModel(this.model.path, this.model.source);
                this.element.close();
              },
            },
            ['Download model'],
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'tool share-close',
              onclick: () => {
                this.element.close();
              },
            },
            ['Close'],
          ),
        ]),
      ],
    );
  }

  /** Opens a sharing explanation for the current text; native dialog closing restores focus. */
  show(path: string, source: string): void {
    this.model = { path, source };
    if (!this.element.open) this.element.showModal();
  }
}
