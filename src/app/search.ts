import type { Id } from '../lines/index.ts';
import { findElements, type Semantics } from '../model/index.ts';
import { h } from './dom.ts';

/** INT-1002: a keyboard-accessible finder whose dialog owns its keys and restores focus. */
export class SearchDialog {
  readonly element: HTMLDialogElement;
  private readonly input: HTMLInputElement;
  private readonly results: HTMLUListElement;
  private readonly status: HTMLElement;
  private model: { semantics: Semantics; audience: Id } | null = null;
  private buttons: HTMLButtonElement[] = [];

  private readonly choose: (id: Id) => void;

  constructor(choose: (id: Id) => void) {
    this.choose = choose;
    this.input = h('input', {
      id: 'element-search-input',
      type: 'search',
      autocomplete: 'off',
      placeholder: 'Name, tag or code reference',
      oninput: () => {
        this.render();
      },
    });
    this.results = h('ul', { class: 'element-search-results', 'aria-label': 'Matching elements' });
    this.status = h('p', { class: 'element-search-status', role: 'status' });
    this.element = h(
      'dialog',
      {
        class: 'element-search',
        'aria-labelledby': 'element-search-title',
        'aria-describedby': 'element-search-help',
        onkeydown: (event) => {
          this.key(event as KeyboardEvent);
        },
        onclose: () => {
          this.model = null;
        },
      },
      [
        h('div', { class: 'element-search-heading' }, [
          h('h1', { id: 'element-search-title' }, ['Find an element']),
          h(
            'button',
            {
              type: 'button',
              class: 'tool',
              onclick: () => {
                this.close();
              },
            },
            ['Close'],
          ),
        ]),
        h('label', { for: 'element-search-input' }, ['Search the model']),
        this.input,
        h('p', { id: 'element-search-help' }, [
          'Search every audience’s wording. Use Up and Down to move through results, Enter to choose, or Escape to close.',
        ]),
        this.status,
        this.results,
      ],
    );
    this.element.addEventListener('cancel', (event) => {
      event.stopPropagation();
    });
  }

  show(semantics: Semantics, audience: Id): void {
    this.model = { semantics, audience };
    this.input.value = '';
    this.render();
    if (!this.element.open) this.element.showModal();
    this.input.focus();
  }

  close(): void {
    if (this.element.open) this.element.close();
  }

  private render(): void {
    const model = this.model;
    if (model === null) return;
    const matches = findElements(model.semantics, model.audience, this.input.value);
    this.buttons = [];
    this.results.replaceChildren(
      ...matches.map((match) => {
        const button = h(
          'button',
          {
            type: 'button',
            class: 'element-search-result',
            'data-find-element': match.id,
            disabled: match.views.length === 0,
            onclick: () => {
              this.close();
              this.choose(match.id);
            },
          },
          [
            h('span', { class: 'element-search-name' }, [match.name]),
            h('span', { class: 'element-search-id' }, [match.id]),
            h('span', { class: 'element-search-path' }, [match.path || 'Top level']),
            match.names.length === 0
              ? null
              : h('span', { class: 'element-search-aliases' }, [match.names.join(' · ')]),
            match.views.length === 0 ? h('span', {}, ['Not included in any view']) : null,
          ],
        );
        if (!button.disabled) this.buttons.push(button);
        return h('li', {}, [button]);
      }),
    );
    this.status.textContent =
      matches.length === 0
        ? 'No elements match your search.'
        : `${String(matches.length)} ${matches.length === 1 ? 'element' : 'elements'} found`;
  }

  private key(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Escape') {
      // A search input consumes Escape to clear its value before the dialog can cancel.
      event.preventDefault();
      this.close();
      return;
    }
    const active = document.activeElement;
    const at = this.buttons.findIndex((button) => button === active);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next =
        at < 0
          ? event.key === 'ArrowDown'
            ? 0
            : this.buttons.length - 1
          : (at + (event.key === 'ArrowDown' ? 1 : -1) + this.buttons.length) % this.buttons.length;
      this.buttons[next]?.focus();
    } else if (event.key === 'Enter' && active === this.input) {
      event.preventDefault();
      this.buttons[0]?.click();
    } else if ((event.key === 'Home' || event.key === 'End') && at >= 0) {
      event.preventDefault();
      this.buttons[event.key === 'Home' ? 0 : this.buttons.length - 1]?.focus();
    }
  }
}
