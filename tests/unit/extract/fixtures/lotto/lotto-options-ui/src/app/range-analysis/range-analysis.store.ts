import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { components } from '../../generated/schema';
import { ActiveGameStore } from '../shared/active-game.store';

export type RangeAnalysisResponse   = components['schemas']['RangeAnalysisViewModel'];
export type RangeDrawResult         = components['schemas']['DrawResultViewModel'];
export type RangePerformanceMetrics = components['schemas']['RangePerformanceMetricsViewModel'];
export type PositionAnalysis        = components['schemas']['PositionAnalysisViewModel'];
export type RangeAnalysisRequest    = components['schemas']['RangeAnalysisRequest'];

// Re-export from utils so callers have a single import point for types
export type { RangeStatus } from './range-analysis.utils';

/**
 * Single cross-component state store for the Range Analysis view (FR-017-A, Decision 4).
 *
 * Provided at root so that navigation away and back preserves the last selection
 * (see Section 1.2 Decision 4 for rationale). If scope isolation is needed, move
 * to `providers: [RangeAnalysisStore]` on RangeAnalysisPageComponent and document here.
 *
 * All cross-template state is signal-based. RxJS is used only in the HTTP trigger.
 */
@Injectable({ providedIn: 'root' })
export class RangeAnalysisStore {
  private readonly activeGameStore = inject(ActiveGameStore);

  // --- Game-derived computed signals (FR-019-D) -------------------------

  /**
   * Number of positions for the active game.
   * Priority: activePickCount > 0 → use it; else response positionAnalysis length; else 5.
   */
  readonly pickCount = computed<number>(() => {
    const raw = this.activeGameStore.activePickCount();
    if (raw > 0) return raw;
    const fromResponse = this.response()?.positionAnalysis?.length;
    return (fromResponse && fromResponse > 0) ? fromResponse : 5;
  });

  /** Pool size for the active game (max ball number). Defaults to 35. */
  readonly poolSize = computed<number>(() => this.activeGameStore.activeMaxNumber());

  /** Position labels derived from pickCount: ['P1', 'P2', ..., 'P{n}']. */
  readonly positionLabels = computed<string[]>(() =>
    Array.from({ length: this.pickCount() }, (_, i) => `P${i + 1}`)
  );

  // --- Client control signals -------------------------------------------

  readonly rangeSize     = signal<number>(5);
  readonly mode          = signal<'ACTUAL' | 'DELTA' | 'DELTA_SORTED'>('ACTUAL');
  /** Position toggles - length tracks pickCount(); at least one must remain true. */
  readonly positions     = signal<boolean[]>(Array<boolean>(this.pickCount()).fill(true));
  /** Configurable analysis window; NOT hardcoded - fixes legacy defect #6. */
  readonly maxDraws      = signal<number>(60);
  /** The range label driving chart + col highlight + bar highlight. */
  readonly selectedRange = signal<string | null>(null);
  /** 0-based position tab for Position Insights (0 = P1). */
  readonly insightPos    = signal<number>(0);
  /** 0-based current page for the Draw Results paginator. */
  readonly page          = signal<number>(0);
  readonly rowsPerPage   = signal<10 | 20 | 50>(10);

  constructor() {
    /**
     * Game-switch effect: when pickCount changes, reset positions to all-on for the
     * new game, reset page to 0, and clear selectedRange (FR-019-D, Decision 2).
     *
     * `allowSignalWrites: true` is required because this effect writes to signals.
     * This is a known escape hatch (deprecated in Angular 19+). The canonical
     * replacement is `linkedSignal`, which models "reset a writable signal when a
     * dependency changes" without needing allowSignalWrites. The effect is safe here
     * because its only reactive dependency is `pickCount()`, and the signals it writes
     * (`positions`, `page`, `selectedRange`) do NOT feed back into `pickCount` - no
     * circular dependency or infinite-loop risk. Prefer converting to `linkedSignal`
     * if/when the project upgrades to a version where that pattern is stable for
     * multi-signal reset (currently requires one linkedSignal per reset target).
     *
     * @see https://angular.dev/guide/signals#linkedsignal (future migration path)
     */
    effect(() => {
      const n = this.pickCount();
      this.positions.set(Array<boolean>(n).fill(true));
      this.page.set(0);
      this.selectedRange.set(null);
    }, { allowSignalWrites: true });
  }

  // --- HTTP state signals -----------------------------------------------

  readonly loading  = signal<boolean>(false);
  readonly error    = signal<string | null>(null);
  readonly response = signal<RangeAnalysisResponse | null>(null);

  // --- Derived / computed values ----------------------------------------

  readonly rangeHeaders = computed(() => this.response()?.rangeHeaders ?? []);

  readonly pageCount = computed(() =>
    Math.ceil((this.response()?.drawResults?.length ?? 0) / this.rowsPerPage())
  );

  readonly pagedRows = computed<RangeDrawResult[]>(() => {
    const start = this.page() * this.rowsPerPage();
    return (this.response()?.drawResults ?? []).slice(start, start + this.rowsPerPage());
  });

  /**
   * Last min(N, 40) draw results for the chart - reversed to oldest→newest.
   * Matches the buildChartWindow util but done at the store level so the
   * full list is available for downstream use.
   */
  readonly chartWindow = computed<RangeDrawResult[]>(() => {
    const results = this.response()?.drawResults ?? [];
    return results.slice(0, Math.min(results.length, 40)).reverse();
  });

  // --- Guard mutations --------------------------------------------------

  /**
   * Resolves selectedRange to the first available rangeHeader if the current
   * value is absent after a range-size or mode change.
   * Also resets page to 0.
   */
  resolveSelectedRange(): void {
    const headers = this.rangeHeaders();
    const current = this.selectedRange();
    if (!current || !headers.includes(current)) {
      this.selectedRange.set(headers[0] ?? null);
    }
    this.page.set(0);
  }

  /**
   * Clamps page to [0, pageCount-1]. Never negative, never beyond bound.
   */
  clampPage(): void {
    const max = Math.max(0, this.pageCount() - 1);
    const cur = this.page();
    if (cur < 0)   { this.page.set(0);   return; }
    if (cur > max) { this.page.set(max); return; }
  }

  /**
   * Enforces the "at least one position must stay on" guard.
   * If all are false, forces P1 (index 0) back to true.
   */
  setPositions(next: boolean[]): void {
    const clamped = [...next];
    if (clamped.every(v => !v)) {
      clamped[0] = true;
    }
    this.positions.set(clamped);
  }

  /**
   * Changes rowsPerPage and resets page to 0.
   */
  setRowsPerPage(rpp: 10 | 20 | 50): void {
    this.rowsPerPage.set(rpp);
    this.page.set(0);
  }

  /**
   * Returns the number of active position toggles (for §06 fallback).
   */
  activePositionCount(): number {
    return this.positions().filter(Boolean).length;
  }
}
