// The layout engine for the browser (LAYOUT-005): ELK runs in a Web Worker started from the bundled
// `elk-worker.min.js`, so laying out a picture never blocks the page. Node uses in-process.ts.
import elkWorkerUrl from 'elkjs/lib/elk-worker.min.js?url';
import type { LayoutEngine } from '../types.ts';
import { factoryEngine, type WorkerFactory } from './worker-factory.ts';

/** How a worker is started; the default starts the bundled ELK worker script. */
export type { WorkerFactory } from './worker-factory.ts';

/** A layout engine whose ELK runs in a Web Worker. */
export function workerEngine(
  factory: WorkerFactory = (url) => new Worker(url ?? elkWorkerUrl),
): LayoutEngine {
  return factoryEngine(factory, elkWorkerUrl);
}
