import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get('/api/orders');
  }

  pay(order: string) {
    return this.http.post('https://pay.example.com/v1/charges', { order });
  }
}
