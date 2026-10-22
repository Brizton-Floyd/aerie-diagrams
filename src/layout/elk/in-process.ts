// The layout engine that runs ELK in the calling thread: for tests, the command line and anything
// else in Node (LAYOUT-005). The browser uses the Web Worker engine in worker.ts instead.
import ELK from 'elkjs/lib/elk.bundled.js';
import type { LayoutEngine } from '../types.ts';
import { ElkLayoutEngine } from './adapter.ts';

export function inProcessEngine(): LayoutEngine {
  return new ElkLayoutEngine(new ELK());
}
