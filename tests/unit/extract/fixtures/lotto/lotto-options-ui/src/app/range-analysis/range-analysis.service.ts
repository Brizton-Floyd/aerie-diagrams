import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { components } from '../../generated/schema';

// Type aliases against the generated schema (FR-017-A, Decision 5)
export type RangeAnalysisResponse   = components['schemas']['RangeAnalysisViewModel'];
export type RangeDrawResult         = components['schemas']['DrawResultViewModel'];
export type RangePerformanceMetrics = components['schemas']['RangePerformanceMetricsViewModel'];
export type PositionAnalysis        = components['schemas']['PositionAnalysisViewModel'];
export type RangeAnalysisRequest    = components['schemas']['RangeAnalysisRequest'];

/**
 * HTTP client for the BFF range-analysis endpoint (FR-016 POST /ui/range-analysis).
 *
 * Calls the BFF synchronously - one POST per run. No SSE, no polling, no direct
 * Core API calls. The Angular range-analysis screen (FR-017) is the sole consumer.
 */
@Injectable({ providedIn: 'root' })
export class RangeAnalysisService {
  private readonly http = inject(HttpClient);

  /**
   * Issues a POST /ui/range-analysis request and returns the typed response Observable.
   * The caller (RangeAnalysisPageComponent) is responsible for subscribe/teardown.
   */
  analyze(request: RangeAnalysisRequest): Observable<RangeAnalysisResponse> {
    return this.http.post<RangeAnalysisResponse>('/ui/range-analysis', request);
  }
}
