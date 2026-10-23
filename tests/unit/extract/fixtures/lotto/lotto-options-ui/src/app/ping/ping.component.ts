import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { PingService } from './ping.service';

@Component({
  selector: 'app-ping',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pingResult()) {
      <p>Status: {{ pingResult()!.status }}</p>
      <p>Message: {{ pingResult()!.message }}</p>
    } @else {
      <p>Loading...</p>
    }
  `
})
export class PingComponent {
  protected readonly pingResult = toSignal(inject(PingService).ping(), { initialValue: null });
}
