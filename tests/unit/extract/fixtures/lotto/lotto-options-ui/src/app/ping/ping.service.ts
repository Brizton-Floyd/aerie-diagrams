import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { components } from '../../generated/schema';

export type PingResponse = components['schemas']['PingViewModel'];

@Injectable({ providedIn: 'root' })
export class PingService {
  private readonly http = inject(HttpClient);

  ping(): Observable<PingResponse> {
    return this.http.get<PingResponse>('/ui/ping');
  }
}
