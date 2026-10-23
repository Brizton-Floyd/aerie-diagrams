import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { components } from '../../generated/schema';

export type DashboardAggregates    = components['schemas']['DashboardAggregatesViewModel'];
export type NumberFrequency        = components['schemas']['NumberFrequencyViewModel'];
export type RangeRollup            = components['schemas']['RangeRollupViewModel'];
export type PatternAnalysis        = components['schemas']['PatternAnalysisViewModel'];
export type PatternEntry           = components['schemas']['PatternEntryViewModel'];
export type PatternEdge            = components['schemas']['PatternEdgeViewModel'];
export type MatrixPage             = components['schemas']['MatrixPageViewModel'];
export type MatrixRow              = components['schemas']['MatrixRowViewModel'];
export type MatrixCell             = components['schemas']['MatrixCellViewModel'];
export type PositionTrend          = components['schemas']['PositionTrendViewModel'];
export type TrendPeriod            = components['schemas']['TrendPeriodViewModel'];
export type TrendIndicators        = components['schemas']['TrendIndicatorsViewModel'];
export type TrendAnalysis          = components['schemas']['TrendAnalysisViewModel'];
export type OddEvenSummary         = components['schemas']['OddEvenSummaryViewModel'];
export type HighLowSummary         = components['schemas']['HighLowSummaryViewModel'];
export type SumRangeSummary        = components['schemas']['SumRangeSummaryViewModel'];
export type SegmentsSummary        = components['schemas']['SegmentsSummaryViewModel'];
export type SegmentEntry           = components['schemas']['SegmentEntryViewModel'];
export type SegmentNumberDetail    = components['schemas']['SegmentNumberDetailViewModel'];
export type SegmentRecommendation  = components['schemas']['SegmentRecommendationViewModel'];
export type PatternSummaryEntry    = components['schemas']['PatternSummaryEntryViewModel'];
export type HistoryRange           = components['schemas']['HistoryRangeViewModel'];
export type LatestDraw             = components['schemas']['LatestDrawViewModel'];
export type DrawnBall              = components['schemas']['DrawnBallViewModel'];
export type StateCatalog           = components['schemas']['StateCatalogViewModel'];
export type StateEntry             = components['schemas']['StateEntryViewModel'];
export type GameSummary            = components['schemas']['GameSummaryViewModel'];
export type GenerateNumbersRequest = components['schemas']['GenerateNumbersRequest'];
export type GeneratedNumbers       = components['schemas']['GeneratedNumbersViewModel'];
export type PrizeLevel             = components['schemas']['PrizeLevelViewModel'];

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  getAggregates(state: string, game: string): Observable<DashboardAggregates> {
    return this.http.get<DashboardAggregates>(`/ui/dashboard/${encodeURIComponent(state)}/${encodeURIComponent(game)}`);
  }

  getMatrixPage(state: string, game: string, endIndex: number, size: number): Observable<MatrixPage> {
    return this.http.get<MatrixPage>(`/ui/dashboard/${encodeURIComponent(state)}/${encodeURIComponent(game)}/matrix`, {
      params: { endIndex: String(endIndex), size: String(size) }
    });
  }

  getPositionTrend(state: string, game: string, position: number, range: string): Observable<PositionTrend> {
    return this.http.get<PositionTrend>(`/ui/dashboard/${encodeURIComponent(state)}/${encodeURIComponent(game)}/position-trend`, {
      params: { position: String(position), range }
    });
  }

  /**
   * Walk-forward pattern edge detector (FR-015). Returns whether the decade-bucket
   * fingerprints have a statistically significant OUT-OF-SAMPLE predictive edge over
   * the combinatorial chance baseline. For a fair lottery this returns "No edge".
   */
  getPatternEdge(state: string, game: string, topN = 5): Observable<PatternEdge> {
    return this.http.get<PatternEdge>(`/ui/dashboard/${encodeURIComponent(state)}/${encodeURIComponent(game)}/pattern-edge`, {
      params: { topN: String(topN) }
    });
  }

  generate(state: string, game: string, req: GenerateNumbersRequest): Observable<GeneratedNumbers> {
    return this.http.post<GeneratedNumbers>(
      `/ui/dashboard/${encodeURIComponent(state)}/${encodeURIComponent(game)}/generate`,
      req
    );
  }

  generateBetslipPdf(state: string, game: string, req: BetslipPdfRequest): Observable<Blob> {
    return this.http.post(
      `/ui/dashboard/${encodeURIComponent(state)}/${encodeURIComponent(game)}/betslip/pdf`,
      req,
      { responseType: 'blob' }
    );
  }
}

/** Color rendering mode for the generated playslip PDF (maps to the Core enum). */
export type BetslipColorMode = 'COLOR' | 'BLACK_AND_WHITE' | 'SCANNER_READY';

/**
 * Request body for the betslip PDF endpoint (FR-014). `state`/`game` travel in the path;
 * the body carries the generated sets and rendering options. Kept as a hand-written type
 * (rather than the generated schema alias) so the blob-returning call site stays explicit.
 */
export interface BetslipPdfRequest {
  numberSets: number[][];
  bonusNumbers: number[];
  globalOption: string | null;
  colorMode: BetslipColorMode;
}
