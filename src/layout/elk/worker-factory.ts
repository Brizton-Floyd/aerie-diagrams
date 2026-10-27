import ELK, { type ELKConstructorArguments } from 'elkjs/lib/elk-api.js';
import type { LayoutEngine } from '../types.ts';
import { ElkLayoutEngine } from './adapter.ts';

export type WorkerFactory = NonNullable<ELKConstructorArguments['workerFactory']>;

/** A layout worker supplied by the host, including a Blob worker in a portable reader. */
export function factoryEngine(factory: WorkerFactory, workerUrl?: string): LayoutEngine {
  return new ElkLayoutEngine(
    new ELK({ workerFactory: factory, ...(workerUrl === undefined ? {} : { workerUrl }) }),
  );
}
