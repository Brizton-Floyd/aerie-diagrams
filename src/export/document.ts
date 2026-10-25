// A format-independent, authored export document (EXPORT-001 to EXPORT-004).
import type { Id } from '../lines/index.ts';
import { proseFor, wordsFor, type Semantics, type Zoom } from '../model/index.ts';

export interface ExportOptions {
  view: Id;
  audience: Id;
  scenario: Id | null;
  reference: boolean;
}
export interface ExportBlock {
  kind: 'section' | 'heading' | 'paragraph' | 'label';
  text: string;
}
export interface ExportDocument {
  title: string;
  audience: string;
  about: string | null;
  code: boolean;
  scenario: string | null;
  zoom: Zoom;
  elementIds: readonly Id[];
  blocks: readonly ExportBlock[];
}

/** Only flows whose actual participants fit the expanded view can be exported there. */
export function compatibleFlow(semantics: Semantics, view: Id, scenario: Id): boolean {
  const drawn = semantics.drawn(view, semantics.scope(view).everythingOpen());
  return semantics
    .scenario(scenario)
    .steps.every((s) => drawn.has(s.subject) && drawn.has(s.object));
}

/** Never reads repository files or fabricates prose; every explanation comes from the model. */
export function exportDocument(semantics: Semantics, options: ExportOptions): ExportDocument {
  const { view, audience, scenario, reference } = options;
  const zoom = semantics.scope(view).everythingOpen();
  const scene = semantics.scene(semantics.drawing(view, zoom), audience);
  const blocks: ExportBlock[] = [];
  const add = (kind: ExportBlock['kind'], text: string | null): void => {
    if (text !== null && text.trim() !== '') blocks.push({ kind, text });
  };
  let scenarioName: string | null = null;
  if (scenario !== null) {
    if (!compatibleFlow(semantics, view, scenario))
      throw new Error(
        'This flow includes elements outside this view. Choose another flow or a view containing all its participants.',
      );
    const authored = semantics.scenario(scenario);
    scenarioName = wordsFor(authored.title, audience) ?? scenario;
    add('section', `Scenario: ${scenarioName}`);
    add('paragraph', proseFor(authored.about, audience));
    const steps = semantics.steps(scenario, audience);
    if (authored.stages !== undefined) {
      for (const stage of semantics.overviewSteps(scenario, audience)) {
        add('heading', `Stage ${String(stage.number)}: ${stage.sentence}`);
        add('paragraph', stage.about);
        for (const step of steps.filter((s) => s.number >= stage.from && s.number <= stage.to)) {
          add('label', `Step ${String(step.number)}: ${step.sentence}`);
          add('paragraph', step.about);
        }
      }
    } else {
      for (const step of steps) {
        add('heading', `Step ${String(step.number)}: ${step.sentence}`);
        add('paragraph', step.about);
      }
    }
  }
  if (reference) {
    add('section', 'Component reference');
    const groups = new Map<Id | null, typeof scene.nodes>();
    for (const node of scene.nodes) {
      const group = groups.get(node.parent) ?? [];
      group.push(node);
      groups.set(node.parent, group);
    }
    const relationships = [
      ...new Map(scene.edges.flatMap((e) => e.relationships).map((r) => [r.index, r])).values(),
    ];
    for (const [parent, nodes] of groups) {
      add(
        'heading',
        parent === null ? 'System and participants' : `Inside ${semantics.name(parent, audience)}`,
      );
      for (const node of nodes) {
        add('label', node.name);
        add('paragraph', node.tagline);
        add('paragraph', node.about ?? 'Full description not documented.');
        const children = scene.nodes.filter((n) => n.parent === node.id);
        if (children.length)
          add('paragraph', `Contains: ${children.map((n) => n.name).join(', ')}`);
        for (const direction of ['Incoming', 'Outgoing'] as const) {
          const connections = relationships.filter((r) =>
            direction === 'Incoming' ? r.object === node.id : r.subject === node.id,
          );
          add('label', `${direction} connections`);
          if (!connections.length) add('paragraph', 'No direct connections in this view.');
          for (const connection of connections) {
            add('paragraph', connection.sentence);
            add('paragraph', connection.about);
          }
        }
      }
    }
  }
  return {
    title: scene.title,
    audience: scene.audience.name,
    about: scene.about,
    code: scene.audience.code,
    scenario: scenarioName,
    zoom,
    elementIds: scene.nodes.map((n) => n.id),
    blocks,
  };
}

/** User-authored names are retained; there is no added application name or source path. */
export function exportFilename(document: ExportDocument, format: 'png' | 'pdf'): string {
  const name = [document.title, document.scenario, document.audience]
    .filter(Boolean)
    .join('-')
    .normalize('NFKC')
    .split('')
    .map((char) => (char.charCodeAt(0) < 32 ? '-' : char))
    .join('')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .slice(0, 160);
  return `${name || 'diagram'}.${format}`;
}
