import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopBarComponent } from './top-bar.component';
import { SidebarNavComponent } from './sidebar-nav.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, TopBarComponent, SidebarNavComponent],
  template: `
    <div class="shell-frame">
      <app-top-bar />
      <div class="shell-body">
        <nav class="shell-sidebar" role="navigation" aria-label="Main navigation">
          <app-sidebar-nav />
        </nav>
        <main class="shell-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      overflow: hidden;
    }
    .shell-frame {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--cc-surface);
      border: 1px solid var(--cc-border-strong);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-frame);
    }
    .shell-body {
      display: flex;
      flex: 1;
      overflow: hidden;
      background: var(--cc-surface-sunken);
    }
    .shell-sidebar {
      width: var(--cc-sidebar-w);
      flex-shrink: 0;
      background: var(--cc-surface);
      border-right: 1px solid var(--cc-border-inner);
      padding: 16px 12px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
    }
    .shell-content {
      flex: 1;
      min-width: 0;
      overflow: auto;
      padding: 18px 20px 22px;
    }
  `]
})
export class AppShellComponent {}
