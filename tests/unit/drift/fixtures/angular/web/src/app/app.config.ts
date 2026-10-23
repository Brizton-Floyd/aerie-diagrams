import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { OrdersService } from './orders.service';

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(), OrdersService],
};
