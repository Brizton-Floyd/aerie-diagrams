import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toSignal, toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, catchError, of, EMPTY } from 'rxjs';
import { DashboardService, MatrixPage, PatternEdge, PositionTrend } from './dashboard.service';
import { ActiveGameStore } from '../shared/active-game.store';
import { MatrixGridComponent } from './matrix-grid.component';
import { FrequencyPanelComponent } from './frequency-panel.component';
import { TradingChartComponent } from './trading-chart.component';
import { PatternAnalysisComponent } from './pattern-analysis.component';
import { ProbabilityPanesComponent } from './probability-panes.component';
import { SegmentsPanelComponent } from './segments-panel.component';
import { StatStripComponent } from '../shell/stat-strip.component';
import { SegmentedControlComponent, SegmentOption } from '../shared/segmented-control.component';

type AnalysisTab = 'prob' | 'seg' | 'trend' | 'pat';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    MatrixGridComponent,
    FrequencyPanelComponent,
    TradingChartComponent,
    PatternAnalysisComponent,
    ProbabilityPanesComponent,
    SegmentsPanelComponent,
    StatStripComponent,
    SegmentedControlComponent
  ],
  template: `
    <app-stat-strip [aggregates]="aggregatesVm()" />

    @if (aggregatesVm(); as agg) {
      <!-- Matrix + frequency rail: always visible (the spine) -->
      <div class="dashboard-layout">
        <div class="matrix-panel">
          <div class="matrix-card-header">
            <div class="mc-titles">
              <div class="mc-title-row">
                <h3 class="mc-title">Draw matrix</h3>
                <span class="mc-badge">{{ windowRange().start | number }}–{{ windowRange().stop | number }} / {{ (matrixPage()?.totalDraws ?? 0) | number }}</span>
              </div>
              <p class="mc-subtitle">
                Numbers {{ agg.fieldMin ?? 1 }}–{{ agg.fieldMax ?? 35 }} × full draw history · scroll to explore · drawn = position colour, value = games out
              </p>
            </div>
            <div class="mc-controls">
              <button type="button" class="heat-toggle" [class.on]="heat()" (click)="heat.set(!heat())">
                <span class="heat-label">Heat</span>
                <span class="switch"><span class="knob"></span></span>
              </button>
              <button class="nav-btn" [disabled]="!hasOlder()" (click)="onNavBack()">‹</button>
              <button class="nav-btn" [disabled]="!hasNewer()" (click)="onNavForward()">›</button>
            </div>
          </div>

          <app-matrix-grid
            [matrixPage]="matrixPage()"
            [heat]="heat()"
            [gameNumberCount]="agg.gameNumberCount ?? 5" />
        </div>

        <div class="frequency-panel">
          <app-frequency-panel [frequencyRollups]="agg.frequencyRollups ?? []" />
        </div>
      </div>

      <!-- Analysis workspace: one mounted panel, switched by the 4-tab bar -->
      <div class="analysis-card">
        <div class="analysis-header">
          <app-segmented-control
            [options]="tabOptions"
            [selected]="analysisTab()"
            (selectionChange)="analysisTab.set($event)" />
          <span class="window-label">{{ analysisScope() }}</span>
        </div>

        @switch (analysisTab()) {
          @case ('prob') {
            <app-probability-panes
              [oddEvenSummary]="agg.oddEvenSummary ?? null"
              [highLowSummary]="agg.highLowSummary ?? null"
              [sumRangeSummary]="agg.sumRangeSummary ?? null"
              [historyRange]="agg.historyRange ?? null"
              [totalDraws]="agg.totalDraws ?? 0" />
          }
          @case ('seg') {
            <app-segments-panel [segmentsSummary]="agg.segmentsSummary ?? null" />
          }
          @case ('trend') {
            @if (trendVm(); as trend) {
              <app-trading-chart
                [trendVm]="trend"
                [gameNumberCount]="agg.gameNumberCount ?? 6"
                (positionChange)="onPositionChange($event)"
                (rangeChange)="onRangeChange($event)" />
            } @else {
              <p class="loading">Loading trends…</p>
            }
          }
          @case ('pat') {
            <app-pattern-analysis
              [patternAnalysis]="agg.patternAnalysis ?? null"
              [patternEdge]="edgeVm()"
              [topN]="patternTopN()"
              (topNChange)="patternTopN.set($event)"
              [poolMax]="agg.fieldMax ?? 35" />
          }
        }
      </div>
    } @else {
      <p class="loading">Loading dashboard…</p>
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 16px; }
    .dashboard-layout { display: flex; flex-direction: row; gap: 16px; overflow: hidden; }
    .matrix-panel {
      flex: 1; overflow: hidden;
      background: var(--cc-surface); border: 1px solid var(--cc-border);
      border-radius: var(--radius-card); padding: 16px;
    }
    .frequency-panel {
      width: 300px; min-width: 300px; max-width: 300px; overflow-y: auto;
      background: var(--cc-surface); border: 1px solid var(--cc-border);
      border-radius: var(--radius-card);
    }
    .analysis-card {
      background: var(--cc-surface); border: 1px solid var(--cc-border);
      border-radius: var(--radius-card);
    }
    .analysis-header {
      display: flex; align-items: center; justify-content: space-between;
      gap: 16px; padding: 14px 16px 0; flex-wrap: wrap;
    }
    .window-label { font-size: 12px; color: var(--cc-text-faint, #8a929e); font-family: var(--cc-font-mono, monospace); }
    .matrix-card-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 16px; margin-bottom: 14px; flex-wrap: wrap;
    }
    .mc-title-row { display: flex; align-items: center; gap: 10px; }
    .mc-title { margin: 0; font-size: 17px; font-weight: 700; }
    .mc-badge {
      font-family: var(--cc-font-mono, 'JetBrains Mono', monospace); font-size: 12px;
      color: #6b7280; background: #f1f2f4; border-radius: 6px; padding: 3px 8px;
    }
    .mc-subtitle { margin: 6px 0 0; color: #8b909a; font-size: 13px; max-width: 540px; }
    .mc-controls { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
    .heat-toggle {
      display: inline-flex; align-items: center; gap: 8px; background: none; border: none;
      cursor: pointer; font-size: 13px; font-weight: 600; color: #14181f; padding: 0;
    }
    .heat-toggle .switch {
      width: 40px; height: 22px; border-radius: 11px; background: #d1d5db;
      position: relative; transition: background .15s;
    }
    .heat-toggle.on .switch { background: #14181f; }
    .heat-toggle .knob {
      position: absolute; top: 2px; left: 2px; width: 18px; height: 18px;
      border-radius: 50%; background: #fff; transition: left .15s;
    }
    .heat-toggle.on .knob { left: 20px; }
    .nav-btn {
      width: 32px; height: 32px; border: 1px solid var(--cc-border-2);
      border-radius: var(--radius-nav); background: var(--cc-surface); cursor: pointer;
      font-size: 18px; display: flex; align-items: center; justify-content: center;
      color: var(--cc-text);
    }
    .nav-btn:disabled { opacity: 0.4; cursor: default; }
    .loading { padding: 16px; color: var(--cc-text-muted); font-style: italic; }
  `]
})
export class DashboardPageComponent {
  private readonly store      = inject(ActiveGameStore);
  private readonly service    = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tabOptions: SegmentOption<AnalysisTab>[] = [
    { label: 'Probability', value: 'prob'  },
    { label: 'Segments',    value: 'seg'   },
    { label: 'Trends',      value: 'trend' },
    { label: 'Patterns',    value: 'pat'   }
  ];

  /**
   * Coalesce state + game into a SINGLE emission. Bridging the two signals
   * independently (combineLatest of two toObservables) produced a transient
   * (newState, oldGame) pair on a cross-state switch, which 404s and - with no
   * error handling - permanently tore down the stream. A computed tuple recomputes
   * once per change and emits only the valid pair.
   */
  private readonly selection = computed(() => ({
    state: this.store.activeState(),
    game: this.store.activeGame()
  }));

  readonly aggregatesVm = toSignal(
    toObservable(this.selection).pipe(
      switchMap(({ state, game }) =>
        this.service.getAggregates(state, game).pipe(
          // A failed fetch must not kill the stream; surface a loading state and
          // recover on the next selection.
          catchError(() => of(null))
        )
      )
    ),
    { initialValue: null }
  );

  /** Selected coverage width (top-N) for the Patterns panel; the user can widen it. */
  readonly patternTopN = signal<number>(5);

  /**
   * Walk-forward pattern edge / coverage readout (FR-015). Independent of the aggregates
   * fetch so a slow/failed computation never blocks the rest of the Patterns panel. Keyed on
   * the coalesced selection AND the chosen top-N, so changing the coverage width re-queries
   * the BFF without disturbing the other panels. Recovers to null on error like {@link aggregatesVm}.
   */
  private readonly edgeSelection = computed(() => ({
    state: this.store.activeState(),
    game: this.store.activeGame(),
    topN: this.patternTopN()
  }));

  readonly edgeVm = toSignal(
    toObservable(this.edgeSelection).pipe(
      switchMap(({ state, game, topN }) =>
        this.service.getPatternEdge(state, game, topN).pipe(
          catchError(() => of(null))
        )
      )
    ),
    { initialValue: null }
  );

  readonly matrixPage       = signal<MatrixPage | null>(null);
  readonly trendVm          = signal<PositionTrend | null>(null);
  readonly analysisTab      = signal<AnalysisTab>('prob');
  readonly heat             = signal<boolean>(true);
  readonly matrixEndIndex   = signal<number>(-1);
  readonly selectedPosition = signal<number>(1);
  readonly selectedRange    = signal<string>('30');

  readonly hasOlder = computed(() => this.matrixPage()?.hasOlder ?? false);
  readonly hasNewer = computed(() => this.matrixPage()?.hasNewer ?? false);

  /**
   * Honest scope label for the active analysis panel (the matrix's 50-row page size must
   * not leak here). Probability / Segments are full-history; Trends follows its selected
   * range; Patterns is capped to a recent window in the BFF (PATTERN_CAP) - and since every
   * draw maps to exactly one fingerprint, the analysed-draw count equals the sum of all
   * pattern frequencies, so we derive it from the data rather than hardcoding the cap.
   */
  readonly analysisScope = computed<string>(() => {
    const agg = this.aggregatesVm();
    const total = agg?.totalDraws ?? 0;
    const fmt = (n: number) => n.toLocaleString('en-US');

    switch (this.analysisTab()) {
      case 'trend': {
        const r = this.selectedRange();
        return r === 'all' ? `all ${fmt(total)} draws` : `last ${r} draws`;
      }
      case 'pat': {
        const analysed = (agg?.patternAnalysis?.allPatterns ?? [])
          .reduce((sum, p) => sum + (p.frequency ?? 0), 0);
        return analysed > 0 && analysed < total
          ? `last ${fmt(analysed)} draws`
          : `${fmt(total)} draws · full history`;
      }
      default:
        return `${fmt(total)} draws · full history`;
    }
  });

  /**
   * Position of the visible window, counted from the most-recent draw (1-based).
   * endIndex is the exclusive upper bound into the OLDEST-first list, so the offset
   * from newest is (total - endIndex). The newest page reads "1–50 / 8,000".
   */
  readonly windowRange = computed<{ start: number; stop: number }>(() => {
    const p = this.matrixPage();
    const total = p?.totalDraws ?? 0;
    const rows  = p?.rows?.length ?? 0;
    if (!rows || !total) return { start: 0, stop: 0 };
    const end = p?.endIndex ?? total;          // resolved exclusive upper bound
    const fromNewest = Math.max(0, total - end);
    return { start: fromNewest + 1, stop: fromNewest + rows };
  });

  constructor() {
    effect(() => {
      const idx   = this.matrixEndIndex();
      const state = this.store.activeState();
      const game  = this.store.activeGame();
      this.service.getMatrixPage(state, game, idx, 50)
        .pipe(catchError(() => EMPTY), takeUntilDestroyed(this.destroyRef))
        .subscribe(page => this.matrixPage.set(page));
    });

    effect(() => {
      if (this.analysisTab() !== 'trend') return;
      const state = this.store.activeState();
      const game  = this.store.activeGame();
      const pos   = this.selectedPosition();
      const range = this.selectedRange();
      this.service.getPositionTrend(state, game, pos, range)
        .pipe(catchError(() => EMPTY), takeUntilDestroyed(this.destroyRef))
        .subscribe(trend => this.trendVm.set(trend));
    });
  }

  /** ‹ - older draws: step the window one page back in time. */
  onNavBack(): void {
    const p = this.matrixPage();
    const size  = p?.pageSize ?? 50;
    const total = p?.totalDraws ?? size;
    const cur   = p?.endIndex ?? total;        // resolve the -1 "newest" sentinel
    this.matrixEndIndex.set(Math.max(cur - size, size));
  }

  /** › - newer draws: step the window one page toward the present. */
  onNavForward(): void {
    const p = this.matrixPage();
    const size  = p?.pageSize ?? 50;
    const total = p?.totalDraws ?? size;
    const cur   = p?.endIndex ?? total;        // resolve the -1 "newest" sentinel
    this.matrixEndIndex.set(Math.min(cur + size, total));
  }
  onPositionChange(position: number): void { this.selectedPosition.set(position); }
  onRangeChange(range: string): void { this.selectedRange.set(range); }
}
