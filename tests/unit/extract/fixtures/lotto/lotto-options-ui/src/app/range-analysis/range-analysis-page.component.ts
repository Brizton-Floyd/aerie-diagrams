import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, switchMap, catchError, EMPTY } from 'rxjs';

import { ActiveGameStore } from '../shared/active-game.store';
import { RangeAnalysisService } from './range-analysis.service';
import { RangeAnalysisStore } from './range-analysis.store';
import { deriveStatus } from './range-analysis.utils';
import { computeSignatures } from './signature-panel.utils';
import type { RangePerformanceMetrics } from './range-analysis.store';
import type { SignatureResult } from './signature-panel.utils';

import { AnalysisSettingsComponent } from './analysis-settings.component';
import { PositionInsightsComponent } from './position-insights.component';
import { RangePerformanceGridComponent } from './range-performance-grid.component';
import { HitTrendChartComponent } from './hit-trend-chart.component';
import { DrawResultsTableComponent } from './draw-results-table.component';
import { PaginatorComponent } from './paginator.component';
import { SignaturePanelComponent } from './signature-panel.component';

/**
 * Smart route host for /analyze/range (FR-017-B).
 *
 * - Owns the single RangeAnalysisStore (all cross-component state lives here).
 * - Fires the initial POST on route activation.
 * - Wires all three rangeSelected output events to store.selectedRange.set().
 * - Handles loading, empty, and error states (FR-017-M).
 * - Debounces control changes ~300 ms before issuing a POST.
 * - Uses inject() for all dependencies (no constructor DI).
 * - All state is OnPush-safe via signal inputs to children.
 */
@Component({
  selector: 'app-range-analysis-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AnalysisSettingsComponent,
    PositionInsightsComponent,
    RangePerformanceGridComponent,
    HitTrendChartComponent,
    DrawResultsTableComponent,
    PaginatorComponent,
    SignaturePanelComponent,
  ],
  template: `
    <div class="ra-layout">
      <!-- LEFT RAIL (296px) -->
      <aside class="ra-rail">
        <div class="rail-card">
          <app-analysis-settings
            [rangeSize]="store.rangeSize()"
            [mode]="store.mode()"
            [positions]="store.positions()"
            [maxDraws]="store.maxDraws()"
            [positionLabels]="store.positionLabels()"
            (rangeSizeChange)="onRangeSizeChange($event)"
            (modeChange)="onModeChange($event)"
            (positionsChange)="store.setPositions($event)"
            (maxDrawsChange)="onMaxDrawsChange($event)"
            (applySettings)="triggerAnalysis()"
            (refreshData)="triggerAnalysis()" />
        </div>

        <div class="rail-card">
          <app-position-insights
            [positionAnalysis]="store.response()?.positionAnalysis ?? []"
            [rangeHeaders]="store.rangeHeaders()"
            [selectedRange]="store.selectedRange()"
            [insightPos]="store.insightPos()"
            [positionLabels]="store.positionLabels()"
            (rangeSelected)="onRangeSelected($event)"
            (insightPosChange)="store.insightPos.set($event)" />
        </div>
      </aside>

      <!-- RIGHT COLUMN (fluid) -->
      <main class="ra-main">
        <!-- Error banner (FR-017-M) -->
        @if (store.error()) {
          <div class="error-banner" role="alert">
            <span class="error-msg">{{ store.error() }}</span>
            <button class="retry-btn" (click)="triggerAnalysis()">Retry</button>
          </div>
        }

        <!-- Loading skeleton (FR-017-M): shown only during first load when no result yet -->
        @if (store.loading() && !store.response()) {
          <div class="skeleton-grid">
            @for (n of skeletonCards; track n) {
              <div class="skeleton-card"></div>
            }
          </div>
          <div class="skeleton-chart"></div>
          <div class="skeleton-table"></div>
        } @else if (!store.response()?.rangeHeaders?.length && !store.loading()) {
          <!-- Empty state -->
          <div class="empty-state">
            <p class="empty-title">No range data</p>
            <p class="empty-sub">Adjust your settings and click Apply Settings to analyze draws.</p>
            <button class="btn-apply-empty" (click)="triggerAnalysis()">Run Analysis</button>
          </div>
        } @else {
          <!-- Range Performance Grid -->
          @if (store.rangeHeaders().length) {
            <section class="section-card">
              <h3 class="section-title">Range Performance</h3>
              <app-range-performance-grid
                [rangeHeaders]="store.rangeHeaders()"
                [performanceMetrics]="store.response()?.performanceMetrics ?? []"
                [selectedRange]="store.selectedRange()"
                [drawResults]="store.response()?.drawResults ?? []"
                [poolSize]="store.poolSize()"
                [selectedPositionCount]="store.activePositionCount()"
                (rangeSelected)="onRangeSelected($event)" />
            </section>
          }

          <!-- Hit-Trend Chart + Stat Block -->
          @if (store.selectedRange()) {
            <section class="section-card chart-section">
              <!-- Stat block (FR-017-H) -->
              <div class="stat-block">
                <h4 class="stat-block-title">{{ store.selectedRange() }}</h4>
                <div class="hero-status"
                  [class.status-hot]="selectedMetricStatus() === 'HOT'"
                  [class.status-cold]="selectedMetricStatus() === 'COLD'"
                  [class.status-overdue]="selectedMetricStatus() === 'OVERDUE'"
                  [class.status-hold]="selectedMetricStatus() === 'HOLD'">
                  <span class="hero-badge">{{ selectedMetricStatusLabel() }}</span>
                  <div class="hero-hits">
                    <span class="hero-num">{{ selectedMetric()?.totalHits ?? '-' }}</span>
                    <span class="hero-sub">total hits</span>
                  </div>
                  <div class="hero-freq">
                    <span class="hero-num">{{ selectedFreqPct() }}</span>
                    <span class="hero-sub">vs expected {{ selectedExpectedPct() }}</span>
                  </div>
                </div>

                <div class="stat-tiles">
                  <div class="stat-tile">
                    <span class="tile-val">{{ selectedStreakLabel() }}</span>
                    <span class="tile-key">Streak</span>
                  </div>
                  <!-- Gap tile: "Draws since last hit" - NOT "Hit: N" (defect #5 fix) -->
                  <div class="stat-tile">
                    <span class="tile-val">{{ selectedMetric()?.daysSinceLastHit ?? '-' }}</span>
                    <span class="tile-key">Draws since last hit</span>
                  </div>
                  <div class="stat-tile">
                    <span class="tile-val">{{ selectedMetric()?.lastHitDraw ?? '-' }}</span>
                    <span class="tile-key">Last hit date</span>
                  </div>
                </div>
              </div>

              <div class="chart-area">
                <h4 class="section-title">Hit Trend</h4>
                @if (store.loading()) {
                  <div class="chart-loading">Updating…</div>
                }
                <app-hit-trend-chart
                  [chartWindow]="store.chartWindow()"
                  [selectedRange]="store.selectedRange()"
                  [positionCount]="store.activePositionCount()"
                  [metric]="selectedMetric()" />
              </div>
            </section>
          }

          <!-- Draw Results Matrix -->
          @if (store.response()?.drawResults?.length) {
            <section class="section-card">
              <h3 class="section-title">Draw Results Matrix</h3>
              <app-draw-results-table
                [rows]="store.pagedRows()"
                [rangeHeaders]="store.rangeHeaders()"
                [selectedRange]="store.selectedRange()"
                (rangeSelected)="onRangeSelected($event)" />
              <app-paginator
                [page]="store.page()"
                [pageCount]="store.pageCount()"
                [totalRows]="store.response()?.drawResults?.length ?? 0"
                [rowsPerPage]="store.rowsPerPage()"
                (pageChange)="onPageChange($event)"
                (rowsPerPageChange)="store.setRowsPerPage($event)" />
            </section>
          }

          <!-- Range Signature Capture Panel (FR-022) -->
          <section class="section-card">
            <app-signature-panel
              [result]="signatures()"
              [topN]="signatureTopN()"
              (topNChange)="signatureTopN.set($event)" />
          </section>
        }
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; min-width: 1360px; overflow-x: auto; }

    .ra-layout {
      display: flex; gap: 16px; padding: 16px;
      align-items: flex-start;
    }
    .ra-rail {
      width: 296px; min-width: 296px; flex-shrink: 0;
      display: flex; flex-direction: column; gap: 12px;
    }
    .ra-main {
      flex: 1; display: flex; flex-direction: column; gap: 16px; min-width: 0;
    }
    .rail-card {
      background: var(--cc-surface); border: 1px solid var(--cc-border);
      border-radius: var(--radius-card); padding: 14px;
    }
    .section-card {
      background: var(--cc-surface); border: 1px solid var(--cc-border);
      border-radius: var(--radius-card); padding: 16px;
      display: flex; flex-direction: column; gap: 12px;
    }
    .section-title { margin: 0; font-size: 14px; font-weight: 700; color: var(--cc-ink); }

    /* Error banner */
    .error-banner {
      background: #FCE9E7; border: 1px solid #F5B8B8; border-radius: 10px;
      padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px;
    }
    .error-msg { font-size: 13px; color: #C2342B; }
    .retry-btn {
      border: 1px solid #C2342B; background: #fff; color: #C2342B;
      border-radius: 6px; padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer;
    }

    /* Skeletons */
    .skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(152px, 1fr)); gap: 10px; }
    .skeleton-card {
      height: 140px; background: linear-gradient(90deg, #f0f1f4 25%, #e7e9ee 50%, #f0f1f4 75%);
      background-size: 200% 100%; animation: shimmer 1.4s infinite;
      border-radius: var(--radius-card-sm);
    }
    .skeleton-chart {
      height: 260px; background: linear-gradient(90deg, #f0f1f4 25%, #e7e9ee 50%, #f0f1f4 75%);
      background-size: 200% 100%; animation: shimmer 1.4s infinite;
      border-radius: var(--radius-card);
    }
    .skeleton-table {
      height: 200px; background: linear-gradient(90deg, #f0f1f4 25%, #e7e9ee 50%, #f0f1f4 75%);
      background-size: 200% 100%; animation: shimmer 1.4s infinite;
      border-radius: var(--radius-card);
    }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

    /* Empty state */
    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 300px; gap: 10px; text-align: center;
    }
    .empty-title { font-size: 18px; font-weight: 700; color: var(--cc-ink); margin: 0; }
    .empty-sub { font-size: 13px; color: var(--cc-text-faint); margin: 0; }
    .btn-apply-empty {
      border: none; background: var(--cc-primary); color: #fff;
      border-radius: 8px; padding: 10px 20px; font-size: 13px; font-weight: 700; cursor: pointer;
    }

    /* Chart section layout */
    .chart-section { flex-direction: row; gap: 16px; align-items: flex-start; }
    .stat-block { width: 182px; min-width: 182px; display: flex; flex-direction: column; gap: 10px; }
    .stat-block-title { margin: 0; font-size: 16px; font-weight: 800; font-family: var(--cc-font-mono); color: var(--cc-ink); }
    .chart-area { flex: 1; }
    .chart-loading { font-size: 12px; color: var(--cc-text-faint); font-style: italic; margin-bottom: 4px; }

    /* Hero status card */
    .hero-status {
      border-radius: var(--radius-card-sm); padding: 12px;
      display: flex; flex-direction: column; gap: 6px;
    }
    .status-hot    { background: #FCE9E7; }
    .status-cold   { background: #E9EEFB; }
    .status-overdue { background: #FBF0DD; }
    .status-hold   { background: #F0F1F4; }
    .hero-badge {
      font-size: 10px; font-weight: 800; text-transform: uppercase;
      letter-spacing: .06em; border-radius: 999px; padding: 2px 8px;
      align-self: flex-start;
    }
    .status-hot    .hero-badge { background: #E5484D; color: #fff; }
    .status-cold   .hero-badge { background: #3E63DD; color: #fff; }
    .status-overdue .hero-badge { background: #E0A12A; color: #fff; }
    .status-hold   .hero-badge { background: #AAB1BC; color: #fff; }
    .hero-hits, .hero-freq { display: flex; flex-direction: column; gap: 1px; }
    .hero-num { font-family: var(--cc-font-mono); font-size: 18px; font-weight: 800; color: var(--cc-ink); }
    .hero-sub { font-size: 10px; color: var(--cc-text-faint); }

    /* Stat tiles */
    .stat-tiles { display: flex; flex-direction: column; gap: 6px; }
    .stat-tile {
      display: flex; flex-direction: column; gap: 1px;
      background: var(--cc-surface-sunken); border: 1px solid var(--cc-border);
      border-radius: var(--radius-card-sm); padding: 8px 10px;
    }
    .tile-val { font-family: var(--cc-font-mono); font-size: 14px; font-weight: 700; color: var(--cc-ink); }
    .tile-key { font-size: 10px; color: var(--cc-text-faint); }
  `],
})
export class RangeAnalysisPageComponent implements OnInit {
  readonly store            = inject(RangeAnalysisStore);
  readonly activeGameStore  = inject(ActiveGameStore);
  private readonly service  = inject(RangeAnalysisService);
  private readonly destroyRef = inject(DestroyRef);

  readonly skeletonCards = Array.from({ length: 7 }, (_, i) => i);

  // --- FR-022: Signature Panel signals ---

  /**
   * Local display preference for the top-N summary headline.
   * Not stored in RangeAnalysisStore - has no effect on HTTP calls.
   */
  readonly signatureTopN = signal<3 | 5 | 10>(5);

  /**
   * Computed signature result derived from the existing store signals.
   * Re-evaluates automatically whenever store.response() or store.positions() changes
   * (i.e. after every BFF refetch or position toggle - no manual subscription needed).
   */
  readonly signatures = computed<SignatureResult | null>(() => {
    const response = this.store.response();
    if (!response) return null;
    const drawResults = response.drawResults ?? [];
    const positions   = this.store.positions();
    const rangeSize   = response.gameConfiguration?.rangeSize ?? this.store.rangeSize();
    const rangeHeaders = response.rangeHeaders ?? [];
    return computeSignatures(drawResults, positions, rangeSize, rangeHeaders);
  });

  /** Subject for debounced re-analyze triggers */
  private readonly trigger$ = new Subject<void>();

  constructor() {
    // Game-switch effect: when activeState or activeGame changes, fire a new POST.
    // untracked() prevents trigger$ from being registered as a reactive dependency.
    //
    // NOTE on initial load: Angular effects run once synchronously on construction to
    // register dependencies, so this effect fires BEFORE ngOnInit. ngOnInit also calls
    // triggerAnalysis() at its end. Both emissions land on trigger$ within the same
    // microtask window and are collapsed into a single HTTP call by debounceTime(300),
    // so no double-fetch occurs in practice. The double-push is harmless and expected.
    effect(() => {
      this.activeGameStore.activeState();
      this.activeGameStore.activeGame();
      untracked(() => this.triggerAnalysis());
    });
  }

  ngOnInit(): void {
    // Wire the debounced HTTP trigger
    this.trigger$
      .pipe(
        debounceTime(300),
        switchMap(() => {
          const positions = this.store.positions()
            .map((on, idx) => (on ? idx + 1 : null))
            .filter((v): v is number => v !== null);

          const request = {
            lotteryState: this.activeGameStore.activeState(),
            lotteryGame:  this.activeGameStore.activeGame(),
            rangeSize:    this.store.rangeSize(),
            analysisType: this.store.mode() as 'ACTUAL' | 'DELTA' | 'DELTA_SORTED',
            maxDraws:     this.store.maxDraws(),
            includePerformanceMetrics: true,
            drawPositions: positions,
          };

          this.store.loading.set(true);
          this.store.error.set(null);

          return this.service.analyze(request).pipe(
            catchError((err: unknown) => {
              const msg = err instanceof Error ? err.message : 'Analysis failed. Please retry.';
              this.store.error.set(msg);
              this.store.loading.set(false);
              return EMPTY;
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.store.response.set(response);
        this.store.loading.set(false);
        this.store.resolveSelectedRange();
      });

    // Fire initial analysis on route activation
    this.triggerAnalysis();
  }

  /** All three rangeSelected outputs converge here */
  onRangeSelected(range: string): void {
    this.store.selectedRange.set(range);
  }

  onRangeSizeChange(size: number): void {
    this.store.rangeSize.set(size);
    this.triggerAnalysis();
  }

  onModeChange(mode: 'ACTUAL' | 'DELTA' | 'DELTA_SORTED'): void {
    this.store.mode.set(mode);
    this.triggerAnalysis();
  }

  onMaxDrawsChange(maxDraws: number): void {
    this.store.maxDraws.set(maxDraws);
    this.triggerAnalysis();
  }

  onPageChange(page: number): void {
    this.store.page.set(page);
    this.store.clampPage();
  }

  /** Push to the trigger$ subject (debounced → HTTP call) */
  triggerAnalysis(): void {
    this.trigger$.next();
  }

  // --- Derived values for stat block ---

  readonly selectedMetric = computed<RangePerformanceMetrics | null>(() => {
    const range   = this.store.selectedRange();
    const metrics = this.store.response()?.performanceMetrics ?? [];
    return metrics.find(m => m.range === range) ?? null;
  });

  readonly selectedMetricStatus = computed(() => {
    const m = this.selectedMetric();
    if (!m) return 'HOLD' as const;
    return deriveStatus(m);
  });

  readonly selectedMetricStatusLabel = computed<string>(() => {
    switch (this.selectedMetricStatus()) {
      case 'HOT':    return 'Hot';
      case 'COLD':   return 'Cold';
      case 'OVERDUE': return 'Overdue';
      case 'HOLD':   return 'Hold';
    }
  });

  readonly selectedFreqPct = computed<string>(() => {
    const f = this.selectedMetric()?.hitFrequency;
    return f !== undefined ? `${(f * 100).toFixed(1)}%` : '-';
  });

  readonly selectedExpectedPct = computed<string>(() => {
    const f = this.selectedMetric()?.expectedProbability;
    return f !== undefined ? `${(f * 100).toFixed(1)}%` : '-';
  });

  readonly selectedStreakLabel = computed<string>(() => {
    const s = this.selectedMetric()?.currentStreak;
    if (!s) return '-';
    const match = s.match(/^([A-Z]+)_(\d+)$/);
    return match ? `${match[1]} ×${match[2]}` : s;
  });
}
