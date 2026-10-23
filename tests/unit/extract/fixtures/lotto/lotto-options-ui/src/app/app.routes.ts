import { Routes } from '@angular/router';
import { AppShellComponent } from './shell/app-shell.component';

export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/dashboard-page.component').then(m => m.DashboardPageComponent)
      },
      {
        path: 'smart-generator',
        loadComponent: () =>
          import('./smart-generator/smart-generator.component').then(m => m.SmartGeneratorComponent)
      },
      {
        path: 'random-numbers',
        loadComponent: () =>
          import('./placeholders/random-numbers.placeholder').then(m => m.RandomNumbersPlaceholderComponent)
      },
      {
        path: 'delta-pick',
        loadComponent: () =>
          import('./placeholders/delta-pick.placeholder').then(m => m.DeltaPickPlaceholderComponent)
      },
      {
        path: 'wheel-builder',
        loadComponent: () =>
          import('./placeholders/wheel-builder.placeholder').then(m => m.WheelBuilderPlaceholderComponent)
      },
      {
        path: 'strategy-engine',
        loadComponent: () =>
          import('./placeholders/strategy-engine.placeholder').then(m => m.StrategyEnginePlaceholderComponent)
      },
      {
        path: 'range-analysis',
        loadComponent: () =>
          import('./range-analysis/range-analysis-page.component').then(m => m.RangeAnalysisPageComponent)
      },
      {
        path: 'pattern-analysis',
        loadComponent: () =>
          import('./placeholders/pattern-analysis.placeholder').then(m => m.PatternAnalysisPlaceholderComponent)
      },
      {
        path: 'statistical-tools',
        loadComponent: () =>
          import('./placeholders/statistical-tools.placeholder').then(m => m.StatisticalToolsPlaceholderComponent)
      },
      {
        path: 'history-trends',
        loadComponent: () =>
          import('./placeholders/history-trends.placeholder').then(m => m.HistoryTrendsPlaceholderComponent)
      },
      {
        path: 'betslip-templates',
        loadComponent: () =>
          import('./placeholders/betslip-templates.placeholder').then(m => m.BetslipTemplatesPlaceholderComponent)
      },
      {
        path: 'win-check',
        loadComponent: () =>
          import('./placeholders/win-check.placeholder').then(m => m.WinCheckPlaceholderComponent)
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./placeholders/notifications.placeholder').then(m => m.NotificationsPlaceholderComponent)
      },
      {
        path: 'account-settings',
        loadComponent: () =>
          import('./placeholders/account-settings.placeholder').then(m => m.AccountSettingsPlaceholderComponent)
      },
      // Dev probe - unlisted
      {
        path: 'ping',
        loadComponent: () =>
          import('./ping/ping.component').then(m => m.PingComponent)
      }
    ]
  }
];
