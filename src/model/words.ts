// Audience resolution: what one audience reads (docs/spec/model.md, MODEL-101 to MODEL-104).
// There is no fallback from one audience to another and no inheritance from a container to its
// children (MODEL-103): each rule below reads only the wording it is given.
import type { Id, Prose, Words } from '../lines/index.ts';

/** MODEL-101: the audience's replacement if there is one, otherwise the unmarked wording (or null). */
export function wordsFor(words: Words, audience: Id): string | null {
  return Object.hasOwn(words.set, audience) ? (words.set[audience] ?? null) : words.base;
}

/**
 * MODEL-102: the audience's replacing paragraphs, or the unmarked ones; then its added paragraphs,
 * after a blank line. Null when both parts are missing: the description is empty.
 */
export function proseFor(prose: Prose, audience: Id): string | null {
  const main = Object.hasOwn(prose.set, audience) ? (prose.set[audience] ?? null) : prose.base;
  const added = Object.hasOwn(prose.add, audience) ? (prose.add[audience] ?? null) : null;
  const parts = [main, added].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join('\n\n');
}

/** MODEL-104: subject, verb phrase and object joined by spaces, ended with a full stop. */
export function sentence(subject: string, verb: string, object: string): string {
  return `${subject} ${verb} ${object}.`;
}
