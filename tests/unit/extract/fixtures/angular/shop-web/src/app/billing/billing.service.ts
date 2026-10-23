import { Injectable, signal } from '@angular/core';
import { HttpClient as Http, httpResource } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BillingService {
  readonly plan = signal('basic');
  readonly plans = httpResource(() => `/billing/plans/${this.plan()}`);

  constructor(private http: Http) {}

  pay(amount: number) {
    return this.http.put(`${environment.billingUrl}/pay`, { amount });
  }
}
