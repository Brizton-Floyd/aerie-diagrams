// Preview-first, isolated export session (EXPORT-007 to EXPORT-010).
import type { Picture, Semantics } from '../model/index.ts';
import type { Layouter } from '../layout/index.ts';
import {
  compatibleFlow,
  exportDocument,
  exportFilename,
  exportPages,
  imageSize,
  type ExportOptions,
  type ExportPages,
  type ExportPage,
} from '../export/index.ts';
import { h } from './dom.ts';
import { downloadBlob } from './download.ts';
import { encodeExport, exportFonts, fontPage, stackedPage, svgBlob } from './export-files.ts';

export interface ExportSnapshot {
  semantics: Semantics;
  layouter: Layouter;
  picture: Picture;
  invalid: boolean;
}

export class ExportPanel {
  readonly element: HTMLDialogElement;
  private snapshot: ExportSnapshot | null = null;
  private options: ExportOptions | null = null;
  private format: 'png' | 'pdf' = 'png';
  private readonly flow = h('select', { id: 'export-flow', 'aria-label': 'Flow' });
  private readonly audience = h('select', { id: 'export-audience', 'aria-label': 'Wording' });
  private readonly type = h('select', { id: 'export-format', 'aria-label': 'Format' }, [
    h('option', { value: 'png' }, ['PNG image']),
    h('option', { value: 'pdf' }, ['PDF document']),
  ]);
  private readonly zoom = h('select', { id: 'export-preview-size', 'aria-label': 'Preview size' }, [
    h('option', { value: 'fit' }, ['Fit width']),
    h('option', { value: 'actual' }, ['Actual size']),
  ]);
  private readonly reference = h('input', { id: 'export-reference', type: 'checkbox' });
  private readonly warning = h('p', { class: 'export-warning', role: 'status', hidden: true });
  private readonly status = h('p', {
    class: 'export-status',
    role: 'status',
    'aria-live': 'polite',
  });
  private readonly preview = h('div', {
    class: 'export-preview',
    role: 'region',
    tabindex: 0,
    'aria-label': 'Export preview',
  });
  private readonly download: HTMLButtonElement;
  private readonly retry = h(
    'button',
    {
      type: 'button',
      class: 'tool',
      hidden: true,
      onclick: () => {
        void this.refresh();
      },
    },
    ['Retry preview'],
  );
  private pages: readonly ExportPage[] = [];
  private ready: ExportPages | null = null;
  private urls: string[] = [];
  private revision = 0;

  constructor() {
    this.download = h(
      'button',
      {
        type: 'button',
        class: 'tool export-download',
        disabled: true,
        onclick: () => {
          void this.save();
        },
      },
      ['Download PNG'],
    );
    this.element = h(
      'dialog',
      {
        class: 'export-dialog',
        'aria-labelledby': 'export-title',
        onkeydown: (event) => {
          event.stopPropagation();
        },
        onclose: () => {
          this.revision++;
          this.clearUrls();
          this.snapshot = null;
          this.pages = [];
          this.ready = null;
          this.preview.replaceChildren();
        },
      },
      [
        h('header', { class: 'export-head' }, [
          h('div', {}, [
            h('h1', { id: 'export-title' }, ['Export diagram']),
            h('p', {}, [
              'Current view, fully expanded. Choose the wording and a flow before downloading.',
            ]),
          ]),
          h(
            'button',
            {
              type: 'button',
              class: 'tool',
              onclick: () => {
                this.element.close();
              },
            },
            ['Close export'],
          ),
        ]),
        h('div', { class: 'export-settings' }, [
          h('label', { for: 'export-flow' }, ['Flow', this.flow]),
          h('label', { for: 'export-audience' }, ['Wording', this.audience]),
          h('label', { for: 'export-format' }, ['Format', this.type]),
          h('label', { for: 'export-preview-size' }, ['Preview size', this.zoom]),
          h('label', { class: 'export-reference', for: 'export-reference' }, [
            this.reference,
            'Include component reference',
          ]),
        ]),
        this.warning,
        h('div', { class: 'export-progress' }, [this.status, this.retry, this.download]),
        this.preview,
        h('p', { class: 'export-help' }, [
          'Files are prepared on this device. PDF pages preserve the preview as images; text is not selectable. The document contains no added application branding.',
        ]),
      ],
    );
    this.zoom.addEventListener('change', () => {
      this.preview.classList.toggle('actual-size', this.zoom.value === 'actual');
    });
    for (const control of [this.flow, this.audience, this.type, this.reference])
      control.addEventListener('change', () => {
        void this.refresh();
      });
  }

  show(snapshot: ExportSnapshot): void {
    this.snapshot = snapshot;
    const activity = snapshot.picture.activity;
    const scenario =
      activity.kind === 'overview' || activity.kind === 'playing'
        ? activity.scenario
        : (snapshot.semantics.scope(snapshot.picture.view).view.mainScenario ?? null);
    this.options = {
      view: snapshot.picture.view,
      audience: snapshot.picture.audience,
      scenario,
      reference: false,
    };
    this.format = 'png';
    this.type.value = 'png';
    this.reference.checked = false;
    this.zoom.value = 'fit';
    this.preview.classList.remove('actual-size');
    this.flow.replaceChildren(
      h('option', { value: '' }, ['Architecture only']),
      ...snapshot.semantics.model.scenarios.map((s) =>
        h(
          'option',
          {
            value: s.id,
            disabled: !compatibleFlow(snapshot.semantics, snapshot.picture.view, s.id),
          },
          [s.title.set[snapshot.picture.audience] ?? s.title.base ?? s.id],
        ),
      ),
    );
    this.flow.value = scenario ?? '';
    this.audience.replaceChildren(
      ...snapshot.semantics.model.audiences.map((a) => h('option', { value: a.id }, [a.name])),
    );
    this.audience.value = snapshot.picture.audience;
    this.warning.hidden = !snapshot.invalid;
    this.warning.textContent = snapshot.invalid
      ? 'Your latest edits contain errors. This export uses the last valid model shown in the diagram.'
      : '';
    this.element.showModal();
    void this.refresh();
  }

  private clearUrls(): void {
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.urls = [];
  }

  private async refresh(): Promise<void> {
    const snapshot = this.snapshot;
    if (snapshot === null || this.options === null) return;
    const revision = ++this.revision;
    this.format = this.type.value === 'pdf' ? 'pdf' : 'png';
    this.options = {
      ...this.options,
      audience: this.audience.value,
      scenario: this.flow.value || null,
      reference: this.reference.checked,
    };
    const options = this.options;
    for (const choice of this.flow.options) {
      if (choice.value === '') continue;
      const authored = snapshot.semantics.scenario(choice.value);
      choice.textContent =
        authored.title.set[options.audience] ?? authored.title.base ?? choice.value;
    }
    const format = this.format;
    this.download.textContent = `Download ${format.toUpperCase()}`;
    this.download.disabled = true;
    this.ready = null;
    this.status.textContent = 'Preparing preview…';
    this.retry.hidden = true;
    this.preview.setAttribute('aria-busy', 'true');
    this.clearUrls();
    this.preview.replaceChildren();
    try {
      const document = exportDocument(snapshot.semantics, options);
      const picture = await snapshot.layouter.picture(
        options.view,
        document.zoom,
        options.audience,
      );
      const prepared = exportPages(snapshot.semantics, document, options, picture);
      if (format === 'png') imageSize(prepared.pages);
      const css = await exportFonts();
      if (revision !== this.revision) return;
      this.pages = prepared.pages.map((p) => fontPage(p, css));
      const shown = format === 'png' ? [stackedPage(this.pages)] : this.pages;
      this.preview.replaceChildren(
        ...shown.map((page, index) => {
          const url = URL.createObjectURL(svgBlob(page));
          this.urls.push(url);
          return h('figure', {}, [
            h('img', {
              src: url,
              alt:
                format === 'png'
                  ? 'Complete expanded diagram and explanations'
                  : `Export page ${String(index + 1)} of ${String(shown.length)}`,
              width: page.width,
              height: page.height,
            }),
            h('figcaption', {}, [
              format === 'png'
                ? `${String(Math.ceil(page.width * 2))} × ${String(Math.ceil(page.height * 2))} pixels`
                : `Page ${String(index + 1)} of ${String(shown.length)}`,
            ]),
          ]);
        }),
      );
      this.ready = prepared;
      this.download.disabled = false;
      this.status.textContent =
        format === 'png' ? 'Complete image ready.' : `${String(shown.length)} pages ready.`;
    } catch (error) {
      if (revision === this.revision) {
        this.retry.hidden = false;
        this.status.textContent =
          error instanceof Error ? error.message : 'Could not prepare the export. Try again.';
      }
    } finally {
      if (revision === this.revision) this.preview.setAttribute('aria-busy', 'false');
    }
  }

  private async save(): Promise<void> {
    const ready = this.ready;
    if (ready === null || this.download.disabled) return;
    const revision = this.revision;
    const format = this.format;
    this.download.disabled = true;
    this.status.textContent = 'Preparing download…';
    try {
      const blob = await encodeExport(this.pages, format);
      if (revision !== this.revision || !this.element.open) return;
      downloadBlob(exportFilename(ready.document, format), blob);
      this.status.textContent = 'Download ready.';
    } catch (error) {
      if (revision === this.revision)
        this.status.textContent =
          error instanceof Error
            ? error.message
            : 'Could not create the file. Try again or choose another format.';
    } finally {
      if (revision === this.revision && this.ready !== null) this.download.disabled = false;
    }
  }
}
