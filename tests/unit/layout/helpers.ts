// Shared helpers for the layout tests (docs/spec/layout.md).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Worker as Thread } from 'node:worker_threads';
import { parse } from '../../../src/lines/index.ts';
import { Semantics } from '../../../src/model/index.ts';
import { inProcessEngine } from '../../../src/layout/elk/in-process.ts';
import { Layouter } from '../../../src/layout/index.ts';

export const ROOT = join(import.meta.dirname, '../../..');

export const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

/** The semantics of a Lines source that has no errors. */
export function semanticsOf(source: string): Semantics {
  const result = parse(source);
  if (result.model === null) {
    throw new Error(result.diagnostics.map((found) => found.message).join('\n'));
  }
  return new Semantics(result.model);
}

/** The committed Lotto sample. */
export const LOTTO = semanticsOf(read('samples/lotto.aerie'));

/** One in-process engine shared by the tests. */
export const ENGINE = inProcessEngine();

/** A layouter for a model on the shared engine. */
export const layouter = (semantics: Semantics): Layouter => new Layouter(semantics, ENGINE);

// Starts the ELK worker script the way a browser does: in its own thread, with `self`, `onmessage`
// and `postMessage` as a Web Worker has them.
const BOOT = `
const { parentPort, workerData } = require('node:worker_threads');
globalThis.self = globalThis;
globalThis.postMessage = (data) => parentPort.postMessage(data);
parentPort.on('message', (data) => globalThis.onmessage({ data }));
require(workerData.script);
`;

/** The few members of a Web Worker that a worker engine uses. */
export interface ThreadWorker {
  onmessage: ((event: { data: unknown }) => void) | null;
  postMessage(data: unknown): void;
  terminate(): void;
}

/**
 * A Web Worker running a script in a Node worker thread. `url` is the root-relative address the
 * bundler gives the script, as a browser would fetch it from the dev server.
 */
export function threadWorker(url: string): ThreadWorker {
  const thread = new Thread(BOOT, { eval: true, workerData: { script: join(ROOT, url) } });
  thread.unref();
  const worker: ThreadWorker = {
    onmessage: null,
    postMessage: (data) => {
      thread.postMessage(data);
    },
    terminate: () => {
      void thread.terminate();
    },
  };
  thread.on('message', (data: unknown) => worker.onmessage?.({ data }));
  return worker;
}

/** True when a number has at most two decimal places (LAYOUT-003). */
export const twoPlaces = (value: number): boolean => Math.round(value * 100) / 100 === value;

/** Every number in a nested value. */
export function numbers(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  if (Array.isArray(value)) return value.flatMap(numbers);
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(numbers);
  return [];
}
