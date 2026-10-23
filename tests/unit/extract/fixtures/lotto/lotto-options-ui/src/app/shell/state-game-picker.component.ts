import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { ActiveGameStore } from '../shared/active-game.store';
import { StateCatalog, StateEntry, GameSummary } from '../dashboard/dashboard.service';

/** Positional swatch palette - same 5 colors used by DrawBallComponent. */
const GAME_SWATCH_COLORS = ['#4C4FE0', '#D6409F', '#30A46C', '#F5A623', '#E5484D'];

const FALLBACK_CATALOG: StateCatalog = {
  states: [{ stateName: 'Texas', games: [{ gameName: 'Cash Five', minNumber: 1, maxNumber: 35, pickCount: 5 }] }]
};

/** Internal view-model: game entry enriched with a positional swatch color. */
interface HoveredGame {
  entry: GameSummary;
  swatchColor: string;
  /** True for digit games (Pick 3/4, Daily 3/4 - pool 0–9) which the games-out matrix can't model. */
  disabled: boolean;
  /** Sub-label: number range for standard games, "digit game" for unsupported ones. */
  meta: string;
}

/**
 * Digit games (Pick 3, Daily 4, …) draw 3–4 ordered digits 0–9 with repeats - a pool
 * whose max is < 10 (or a degenerate 1 when no real range is loaded). They cannot be
 * represented on a position/games-out matrix, so they are non-selectable in the picker.
 */
function isDigitGame(entry: GameSummary): boolean {
  return (entry.maxNumber ?? 0) < 10;
}

@Component({
  selector: 'app-state-game-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="picker-root" [class.open]="open()">
      <!-- Resting chip -->
      <button class="picker-chip" (click)="toggleOpen()">
        <span class="game-swatch" [style.background]="activeSwatchColor()"></span>
        <span class="chip-text">
          <span class="chip-eyebrow">GAME</span>
          <span class="chip-label">{{ chipLabel() }}</span>
        </span>
        <span class="chip-chevron">▾</span>
      </button>

      <!-- Cascading dropdown panel -->
      @if (open()) {
        <div class="picker-panel">
          <div class="picker-col">
            @for (s of states(); track s.stateName) {
              <button class="picker-state"
                      [class.selected]="s.stateName === hoveredState()"
                      (click)="selectState(s.stateName ?? '')"
                      (mouseenter)="hoveredState.set(s.stateName ?? '')">
                {{ s.stateName }}
              </button>
            }
          </div>
          <div class="picker-col">
            @for (g of hoveredGames(); track g.entry.gameName) {
              <button class="picker-game"
                      [class.disabled]="g.disabled"
                      [disabled]="g.disabled"
                      [attr.title]="g.disabled ? 'Digit games are not supported by the draw matrix' : null"
                      (click)="selectGame(hoveredState(), g.entry.gameName ?? '')">
                <span class="game-dot" [style.background]="g.swatchColor"></span>
                <span class="game-text">
                  <span class="game-name">{{ g.entry.gameName }}</span>
                  <span class="game-meta">{{ g.meta }}</span>
                </span>
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .picker-root { position: relative; display: inline-flex; }
    .picker-chip {
      display: flex;
      align-items: center;
      gap: 9px;
      background: var(--cc-surface);
      border: 1px solid var(--cc-picker-border);
      border-radius: var(--radius-md);
      padding: 5px 7px 5px 11px;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(18,22,31,0.05);
      font-family: var(--cc-font-sans);
    }
    .game-swatch {
      width: 18px;
      height: 18px;
      border-radius: 5px;
      flex-shrink: 0;
    }
    .chip-text {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
    .chip-eyebrow {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.11em;
      color: var(--cc-text-ghost);
    }
    .chip-label {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--cc-ink);
    }
    .chip-chevron {
      width: 21px;
      height: 21px;
      background: var(--cc-active-bg);
      color: var(--cc-primary);
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    }
    .picker-panel {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      display: flex;
      gap: 0;
      background: var(--cc-surface);
      border: 1px solid var(--cc-border);
      border-radius: var(--radius-md);
      box-shadow: 0 4px 16px rgba(18,22,31,0.12);
      z-index: 1000;
      min-width: 420px;
      overflow: hidden;
    }
    .picker-col {
      display: flex;
      flex-direction: column;
      flex: 1;
      padding: 6px;
      max-height: min(392px, 70vh);
      overflow-y: auto;
    }
    .picker-col + .picker-col {
      border-left: 1px solid var(--cc-border-inner);
    }
    .picker-state, .picker-game {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border: none;
      background: transparent;
      border-radius: var(--radius-nav);
      cursor: pointer;
      font-size: var(--fs-body);
      color: var(--cc-text);
      text-align: left;
      font-family: var(--cc-font-sans);
    }
    .picker-state:hover, .picker-game:hover,
    .picker-state.selected { background: var(--cc-active-bg); color: var(--cc-primary-deep); }
    .game-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .game-text { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.2; }
    .game-meta { font-size: 10px; color: var(--cc-text-ghost); }
    .picker-game.disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
    .picker-game.disabled:hover { background: transparent; color: var(--cc-text); }
    .picker-game.disabled .game-dot { background: var(--cc-text-ghost-2) !important; }
  `]
})
export class StateGamePickerComponent {
  private readonly http   = inject(HttpClient);
  private readonly store  = inject(ActiveGameStore);

  private readonly catalogRaw = toSignal(
    this.http.get<StateCatalog>('/ui/catalog/states').pipe(
      catchError(() => of(FALLBACK_CATALOG))
    ),
    { initialValue: FALLBACK_CATALOG }
  );

  readonly open         = signal(false);
  readonly hoveredState = signal('Texas');

  readonly states = computed<StateEntry[]>(() => this.catalogRaw().states ?? FALLBACK_CATALOG.states ?? []);

  readonly hoveredGames = computed<HoveredGame[]>(() => {
    const stateEntry = this.states().find(s => s.stateName === this.hoveredState());
    const games = stateEntry?.games ?? [];
    return games.map((entry, index) => {
      const disabled = isDigitGame(entry);
      return {
        entry,
        swatchColor: GAME_SWATCH_COLORS[index % GAME_SWATCH_COLORS.length],
        disabled,
        meta: disabled ? 'digit game' : `1–${entry.maxNumber}`
      };
    });
  });

  readonly activeSwatchColor = computed<string>(() => {
    const activeName = this.store.activeState();
    const activeGame = this.store.activeGame();
    const stateEntry = this.states().find(s => s.stateName === activeName);
    const games = stateEntry?.games ?? [];
    const gameIndex = games.findIndex(g => g.gameName === activeGame);
    if (gameIndex < 0) { return GAME_SWATCH_COLORS[0]; }
    return GAME_SWATCH_COLORS[gameIndex % GAME_SWATCH_COLORS.length];
  });

  readonly chipLabel = computed<string>(() => {
    return `${this.store.activeState()} · ${this.store.activeGame()}`;
  });

  toggleOpen(): void { this.open.update(v => !v); }

  selectState(name: string): void { this.hoveredState.set(name); }

  selectGame(stateName: string, gameName: string): void {
    // Guard: digit games are disabled in the template, but never select one even if invoked.
    const game = this.hoveredGames().find(g => g.entry.gameName === gameName);
    if (game?.disabled) { return; }
    const pickCount = game?.entry.pickCount ?? 0;
    const maxNumber = game?.entry.maxNumber ?? 35;
    this.store.setSelection(stateName, gameName, pickCount, maxNumber);
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('app-state-game-picker')) {
      this.open.set(false);
    }
  }
}
