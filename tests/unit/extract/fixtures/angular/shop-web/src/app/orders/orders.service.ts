import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

const BASE = '/api/orders';

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, string>();
  private readonly carts = '/api/carts';

  list() {
    return this.http.get(BASE);
  }

  one(id: string) {
    return this.http.get(`${BASE}/${encodeURIComponent(id)}`);
  }

  checkout() {
    return this.http.post(this.carts + '/checkout', {});
  }

  invoices() {
    return this.http.get(environment.billingUrl + '/invoices');
  }

  report(daily: boolean) {
    return this.http.request('GET', daily ? 'report/daily' : 'report/weekly');
  }

  config() {
    return this.http.get('assets/config.json');
  }

  any(url: string) {
    return this.http.get(url);
  }

  cached() {
    return this.cache.get('/api/not-a-call');
  }
}
