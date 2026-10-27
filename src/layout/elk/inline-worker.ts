import workerSource from 'elkjs/lib/elk-worker.min.js?raw';
import type { LayoutEngine } from '../types.ts';
import { factoryEngine } from './worker-factory.ts';

/** INT-1022: the portable reader owns an embedded layout worker, with no asset requests. */
export function inlineWorkerEngine(): LayoutEngine {
  const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
  return factoryEngine(() => new Worker(url));
}
