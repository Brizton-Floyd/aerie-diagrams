// The layout engine for the browser (LAYOUT-005): ELK runs in a Web Worker started from the bundled
// `elk-worker.min.js`, so laying out a picture never blocks the page. Node uses in-process.ts.
import ELK, { type ELKConstructorArguments } from 'elkjs/lib/elk-api.js';
import elkWorkerUrl from 'elkjs/lib/elk-worker.min.js?url';
import type { LayoutEngine } from '../types.ts';
import { ElkLayoutEngine } from './adapter.ts';

/** How a worker is started; the default starts the bundled ELK worker script. */
export type WorkerFactory = NonNullable<ELKConstructorArguments['workerFactory']>;

/** A layout engine whose ELK runs in a Web Worker. */
export function workerEngine(
  factory: WorkerFactory = (url) => new Worker(url ?? elkWorkerUrl),
): LayoutEngine {
  return new ElkLayoutEngine(new ELK({ workerUrl: elkWorkerUrl, workerFactory: factory }));
}
