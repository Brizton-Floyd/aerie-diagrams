// The model stage of checking: the diagnostics that need the model's meaning, E604 and E703
// (docs/spec/language.md, section 13), and `check`, which adds them to the parser's.
import {
  diagnostic,
  parse,
  sortDiagnostics,
  type Diagnostic,
  type Id,
  type ParseResult,
  type Span,
} from '../lines/index.ts';
import { participants } from './scenarios.ts';
import { Semantics } from './semantics.ts';

const START: Span = { line: 1, column: 1, endLine: 1, endColumn: 1 };

/** E604 and E703 for a valid model, placed with the parser's source map (LANG-807). */
export function modelDiagnostics(
  semantics: Semantics,
  sourceMap: Readonly<Record<string, Span>> = {},
): Diagnostic[] {
  const at = (...pointers: string[]): Span =>
    pointers.map((pointer) => sourceMap[pointer]).find((span) => span !== undefined) ?? START;
  const found: Diagnostic[] = [];
  semantics.model.scenarios.forEach((scenario, index) => {
    if (semantics.stage(scenario.id, null) !== null) return;
    const element = unstaged(semantics, scenario.id);
    const pointer = `/scenarios/${String(index)}`;
    found.push(
      diagnostic(
        'E604',
        at(`${pointer}/id`, pointer),
        scenario.id,
        element,
        semantics.tree.top(element),
      ),
    );
  });
  semantics.model.walkthroughs.forEach((walkthrough, w) => {
    const pictures = semantics.walkPictures(walkthrough.id);
    walkthrough.steps.forEach((step, s) => {
      const picture = pictures[s];
      if (picture === undefined) return;
      const scope = semantics.scope(picture.view);
      const drawn = scope.drawn(picture.zoom);
      step.focus.forEach((id, f) => {
        if (drawn.has(id)) return;
        const container = scope.revealing(picture.zoom, id).opened[0] ?? semantics.tree.top(id);
        const pointer = `/walkthroughs/${String(w)}/steps/${String(s)}`;
        found.push(
          diagnostic(
            'E703',
            at(`${pointer}/focus/${String(f)}`, pointer),
            id,
            picture.view,
            container,
          ),
        );
      });
    });
  });
  return sortDiagnostics(found);
}

/**
 * The participant E604 names: the first, in step order, that no view can hold. When each one fits
 * some view but no view fits them all, it is the first participant missing from the view that holds
 * the most of them (the first such view in declaration order).
 */
function unstaged(semantics: Semantics, scenario: Id): Id {
  const ids = participants(semantics.scenario(scenario));
  const scopes = semantics.views.map((view) => semantics.scope(view.id));
  const homeless = ids.find((id) => !scopes.some((scope) => scope.holds(id)));
  if (homeless !== undefined) return homeless;
  let best = scopes[0];
  let most = -1;
  for (const scope of scopes) {
    const held = ids.filter((id) => scope.holds(id)).length;
    if (held > most) {
      best = scope;
      most = held;
    }
  }
  return ids.find((id) => best?.holds(id) !== true) ?? ids[0] ?? scenario;
}

/**
 * Checks a Lines file completely: the parser's diagnostics and, for a file the parser accepts, the
 * model stage's. As with the parser, a file with errors has no model (LANG-808).
 */
export function check(source: string): ParseResult {
  const parsed = parse(source);
  if (parsed.model === null) return parsed;
  const extra = modelDiagnostics(new Semantics(parsed.model), parsed.sourceMap);
  if (extra.length === 0) return parsed;
  const diagnostics = sortDiagnostics([...parsed.diagnostics, ...extra]);
  if (diagnostics.some((found) => found.severity === 'error')) {
    return { model: null, diagnostics, sourceMap: {} };
  }
  return { ...parsed, diagnostics };
}
