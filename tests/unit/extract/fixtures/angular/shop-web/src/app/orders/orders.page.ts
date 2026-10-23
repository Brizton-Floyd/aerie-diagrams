import { Component, inject } from '@angular/core';
import type { Order } from './order';
import { OrdersService } from './orders.service';
import { BillingService } from '../billing/billing.service';
import { StatusService } from '@shop/ui-kit';

@Component({ selector: 'app-orders', template: '' })
export class OrdersPage {
  readonly orders = inject(OrdersService);
  readonly billing = inject(BillingService);
  readonly status = inject(StatusService);
  readonly selected: Order | null = null;
}
