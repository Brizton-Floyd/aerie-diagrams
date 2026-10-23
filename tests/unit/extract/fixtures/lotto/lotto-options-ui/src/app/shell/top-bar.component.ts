import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActiveGameStore } from '../shared/active-game.store';
import { StateGamePickerComponent } from './state-game-picker.component';

@Component({
  selector: 'app-top-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StateGamePickerComponent],
  template: `
    <header class="top-bar">
      <!-- Logo -->
      <div class="logo-mark">L</div>
      <span class="logo-wordmark">
        Lotto<span class="logo-accent">Options</span>
      </span>

      <!-- Picker -->
      <app-state-game-picker />

      <!-- Spacer -->
      <div class="spacer"></div>

      <!-- Draw-date stepper -->
      <div class="date-stepper">
        <button class="stepper-btn" (click)="stepPrev()" aria-label="Previous draw">‹</button>
        <span class="stepper-date">{{ activeDrawDate() ?? 'Latest draw' }}</span>
        <button class="stepper-btn" (click)="stepNext()" aria-label="Next draw">›</button>
      </div>

      <!-- Search -->
      <button class="icon-btn" aria-label="Search">🔍</button>

      <!-- Notifications -->
      <button class="icon-btn notif-btn" aria-label="Notifications">
        🔔
        <span class="notif-dot"></span>
      </button>

      <!-- Avatar -->
      <div class="avatar">JR</div>
    </header>
  `,
  styles: [`
    .top-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 0 18px;
      height: var(--cc-topbar-h);
      background: var(--cc-surface);
      border-bottom: 1px solid var(--cc-border-inner);
      flex-shrink: 0;
    }
    .logo-mark {
      width: 26px;
      height: 26px;
      border-radius: 8px;
      background: linear-gradient(135deg, #4C4FE0, #6E63E8);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 14px;
      flex-shrink: 0;
    }
    .logo-wordmark {
      font-size: var(--fs-logo);
      font-weight: 800;
      letter-spacing: -0.01em;
      color: var(--cc-ink);
      white-space: nowrap;
    }
    .logo-accent { color: var(--cc-primary); }
    .spacer { flex: 1; }
    .date-stepper {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--cc-surface-2);
      border: 1px solid var(--cc-border);
      border-radius: var(--radius-nav);
      padding: 4px 6px;
    }
    .stepper-btn {
      width: 26px;
      height: 26px;
      border: none;
      background: var(--cc-surface);
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .stepper-date {
      font-size: 13px;
      font-weight: 600;
      color: var(--cc-ink);
      min-width: 90px;
      text-align: center;
    }
    .icon-btn {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-nav);
      border: 1px solid var(--cc-border-2);
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      font-size: 14px;
    }
    .notif-btn { }
    .notif-dot {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--cc-red);
    }
    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #30A46C, #3E63DD);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      flex-shrink: 0;
    }
  `]
})
export class TopBarComponent {
  private readonly store = inject(ActiveGameStore);
  readonly activeDrawDate = this.store.activeDrawDate;

  stepPrev(): void {
    // Stepper logic: in production this resolves the previous draw date.
    // For now, writes a placeholder to the store.
    this.store.setDrawDate('prev');
  }

  stepNext(): void {
    this.store.setDrawDate('next');
  }
}
