// The text editor of the split editor (docs/spec/interaction.md, INT-802 to INT-807), built on
// CodeMirror 6: line numbers, colours by line kind, indenting on Enter and Tab, completion, and
// diagnostics underlined in the text and marked in the margin. What Lines means comes from
// src/lines; this file only connects it to CodeMirror.
import {
  autocompletion,
  completionKeymap,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentLess,
  indentMore,
} from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { lintGutter, setDiagnostics, type Diagnostic as Mark } from '@codemirror/lint';
import { EditorSelection, EditorState, Prec, RangeSetBuilder, type Text } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import {
  completionsAt,
  highlight,
  newLineIndent,
  type Diagnostic,
  type OptionKind,
  type TokenKind,
} from '../lines/index.ts';

const KINDS: readonly TokenKind[] = [
  'keyword',
  'id',
  'rewording',
  'description',
  'comment',
  'tag',
  'kind',
];

const MARKS = new Map(KINDS.map((kind) => [kind, Decoration.mark({ class: `lines-${kind}` })]));

function colour(doc: Text): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const token of highlight(doc.toString())) {
    const mark = MARKS.get(token.kind);
    if (mark === undefined) continue;
    const from = doc.line(token.line).from;
    builder.add(from + token.from, from + token.to, mark);
  }
  return builder.finish();
}

/** INT-802: colours each line by its kind, recoloured on every change. */
const colours = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = colour(view.state.doc);
    }
    update(update: ViewUpdate): void {
      if (update.docChanged) this.decorations = colour(update.state.doc);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

/** INT-803: Enter keeps the indent, and adds two spaces after a line that opens a block. */
function enter(view: EditorView): boolean {
  const { state } = view;
  view.dispatch(
    state.changeByRange((range) => {
      const line = state.doc.lineAt(range.from);
      const indent = newLineIndent(state.doc.toString(), line.number, range.from - line.from);
      const insert = `\n${indent}`;
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.cursor(range.from + insert.length),
      };
    }),
    { scrollIntoView: true, userEvent: 'input' },
  );
  return true;
}

const OPTION_TYPES: Record<OptionKind, string> = {
  keyword: 'keyword',
  element: 'variable',
  tag: 'constant',
  view: 'class',
  scenario: 'function',
  audience: 'namespace',
  icon: 'enum',
  kind: 'type',
};

/** INT-804: completion where the cursor is, offered as the author types a word or after `@` or `[`. */
function complete(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const column = context.pos - line.from;
  const typed = /[a-z0-9-]*$/.exec(line.text.slice(0, column))?.[0] ?? '';
  const trigger = /[@[]$/.test(line.text.slice(0, column - typed.length));
  if (!context.explicit && typed === '' && !trigger) return null;
  const found = completionsAt(context.state.doc.toString(), line.number, column);
  if (found === null) return null;
  return {
    from: line.from + found.from,
    options: found.options.map((option): Completion => ({
      label: option.label,
      type: OPTION_TYPES[option.kind],
      ...(option.detail === undefined ? {} : { detail: option.detail }),
    })),
    validFor: /^[a-z0-9-]*$/,
  };
}

/** The offset of a diagnostic's line and column, where columns count code points (LANG-901). */
function offsetOf(doc: Text, lineNumber: number, column: number): number {
  const line = doc.line(Math.max(1, Math.min(lineNumber, doc.lines)));
  // The checker does not count a byte order mark (LANG-001).
  let offset = lineNumber === 1 && line.text.startsWith('﻿') ? 1 : 0;
  let at = 1;
  for (const char of line.text.slice(offset)) {
    if (at >= column) break;
    offset += char.length;
    at++;
  }
  return line.from + offset;
}

/** Where a diagnostic sits in the text, at least one character wide where the line allows it. */
function rangeOf(doc: Text, found: Diagnostic): { from: number; to: number } {
  const from = offsetOf(doc, found.line, found.column);
  let to = offsetOf(doc, found.endLine, found.endColumn);
  if (to <= from) to = Math.min(from + 1, doc.lineAt(from).to);
  return { from, to: Math.max(from, to) };
}

export interface EditorOptions {
  text: string;
  /** Called after every change to the text. */
  onChange: (text: string) => void;
  /** Shift+Alt+F (INT-807). */
  onFormat: () => void;
}

/** The Lines text editor. */
export class LinesEditor {
  readonly view: EditorView;

  constructor(parent: HTMLElement, options: EditorOptions) {
    this.view = new EditorView({
      parent,
      state: EditorState.create({
        doc: options.text,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          lintGutter(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          // Descriptions are paragraphs, so long lines wrap rather than scroll sideways.
          EditorView.lineWrapping,
          EditorState.tabSize.of(2),
          indentUnit.of('  '),
          colours,
          autocompletion({ override: [complete], icons: false }),
          Prec.high(
            keymap.of([
              { key: 'Enter', run: enter },
              { key: 'Tab', run: indentMore, shift: indentLess },
            ]),
          ),
          keymap.of([...completionKeymap, ...historyKeymap, ...defaultKeymap]),
          // INT-807: Shift+Alt+F, matched by the key's place, since on macOS Option makes the key
          // type a letter of its own and keymaps never see an F.
          Prec.high(
            EditorView.domEventHandlers({
              keydown: (event) => {
                const chord = event.shiftKey && event.altKey && !event.ctrlKey && !event.metaKey;
                if (!chord || event.code !== 'KeyF') return false;
                event.preventDefault();
                options.onFormat();
                return true;
              },
            }),
          ),
          EditorView.contentAttributes.of({ 'aria-label': 'Lines source' }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) options.onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
  }

  get text(): string {
    return this.view.state.doc.toString();
  }

  /**
   * Replaces the text as one change the author can undo, touching only the part that differs, so
   * the cursor stays where it was in the rest (the formatter, INT-807; discarding, INT-808).
   */
  replace(text: string): void {
    const old = this.text;
    if (old === text) return;
    let start = 0;
    while (start < old.length && start < text.length && old[start] === text[start]) start++;
    let end = 0;
    while (
      end < old.length - start &&
      end < text.length - start &&
      old[old.length - 1 - end] === text[text.length - 1 - end]
    ) {
      end++;
    }
    this.view.dispatch({
      changes: { from: start, to: old.length - end, insert: text.slice(start, text.length - end) },
      userEvent: 'input.replace',
    });
  }

  /** INT-806: underlines each diagnostic and marks it in the margin; hovering shows its message. */
  show(diagnostics: readonly Diagnostic[]): void {
    const doc = this.view.state.doc;
    const marks = diagnostics.map((found): Mark => ({
      ...rangeOf(doc, found),
      severity: found.severity,
      message: found.message,
    }));
    this.view.dispatch(setDiagnostics(this.view.state, marks));
  }

  /** INT-806: moves the cursor to a diagnostic. */
  moveTo(found: Diagnostic): void {
    const { from } = rangeOf(this.view.state.doc, found);
    this.view.dispatch({ selection: { anchor: from }, scrollIntoView: true });
    this.view.focus();
  }

  destroy(): void {
    this.view.destroy();
  }
}
