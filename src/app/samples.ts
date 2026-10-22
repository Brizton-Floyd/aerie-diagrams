// The models bundled with the page: the committed samples, the spec's examples and the skill's
// examples, by their path in the repository, so `?model=samples/lotto.aerie` names one (INT-501).
const found = import.meta.glob<string>(
  ['/samples/*.aerie', '/docs/spec/examples/*.aerie', '/skills/aerie/examples/*.aerie'],
  { query: '?raw', import: 'default', eager: true },
);

/** Every bundled model's source, by path without the leading slash, samples first. */
export const SAMPLES: ReadonlyMap<string, string> = new Map(
  Object.entries(found)
    .map(([path, source]): [string, string] => [path.replace(/^\//, ''), source])
    .sort(
      ([a], [b]) =>
        Number(!a.startsWith('samples/')) - Number(!b.startsWith('samples/')) || a.localeCompare(b),
    ),
);

/** The model the page opens with. */
export const FIRST_SAMPLE = 'samples/lotto.aerie';
