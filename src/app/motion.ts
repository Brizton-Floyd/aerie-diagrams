// Motion on the page (docs/spec/look.md, LOOK-901 to LOOK-903): the timings come from the Signal
// stylesheet's custom properties, which are zero under reduced motion, so the page never decides on
// its own whether to move. A change runs as one choreography of animations and timed steps that can
// be finished at once, so changes never interleave (LAYOUT-403).

/** The motion timings the stylesheet defines (`--aerie-<name>`). */
export type MotionName = 'glide' | 'swap' | 'dimming';

/** A motion timing in milliseconds: zero under reduced motion (LOOK-903). */
export function timing(name: MotionName): number {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--aerie-${name}`)
    .trim();
  const ms = parseFloat(value);
  if (!Number.isFinite(ms)) return 0;
  return value.endsWith('ms') ? ms : ms * 1000;
}

/** The glide easing (LOOK-901). */
export function glideEase(): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--aerie-ease').trim() || 'ease'
  );
}

/** The animations and timed steps of one change. */
export class Choreography {
  private animations: Animation[] = [];
  private steps: { timer: number; run: () => void }[] = [];

  /**
   * Animates an element unless the animation would take no time, as under reduced motion: then
   * nothing runs and the element simply shows its own final state.
   */
  animate(
    target: Element,
    keyframes: Keyframe[],
    options: { delay?: number; duration: number; easing?: string; fill?: FillMode },
  ): void {
    if (options.duration <= 0) return;
    const animation = target.animate(keyframes, {
      delay: options.delay ?? 0,
      duration: options.duration,
      easing: options.easing ?? 'ease',
      fill: options.fill ?? 'none',
    });
    this.animations.push(animation);
    void animation.finished
      .catch(() => undefined)
      .then(() => {
        this.animations = this.animations.filter((each) => each !== animation);
      });
  }

  /** Runs a step after a delay, or now when the delay is zero. */
  after(delay: number, run: () => void): void {
    if (delay <= 0) {
      run();
      return;
    }
    const step = {
      run,
      timer: window.setTimeout(() => {
        this.steps = this.steps.filter((each) => each !== step);
        run();
      }, delay),
    };
    this.steps.push(step);
  }

  /** LAYOUT-403: brings everything to its end state at once. */
  finish(): void {
    const steps = this.steps;
    this.steps = [];
    for (const step of steps) {
      window.clearTimeout(step.timer);
      step.run();
    }
    const animations = this.animations;
    this.animations = [];
    for (const animation of animations) {
      animation.finish();
      // A held end state is the element's own state by now, so nothing needs to hold it.
      animation.cancel();
    }
  }
}

/**
 * Wording that changes in a part of the page fades out and back in (LOOK-901: the side panel and
 * the wording swap, 170 ms out and 170 ms in). Content whose markup is unchanged stays as it is, so
 * a change that does not touch this part does not flicker.
 */
export class Swap {
  private readonly host: HTMLElement;
  private readonly motion = new Choreography();
  private shown: HTMLElement | null = null;

  constructor(host: HTMLElement) {
    this.host = host;
  }

  /** Shows new content; `done` runs once it is in place. */
  set(next: HTMLElement, done: (replaced: boolean) => void = () => undefined): void {
    if (this.shown !== null && sameContent(this.shown, next)) {
      done(false);
      return;
    }
    this.motion.finish();
    const old = this.shown;
    this.shown = next;
    const swap = timing('swap');
    const put = (): void => {
      this.host.replaceChildren(next);
      done(true);
    };
    if (old === null || swap <= 0) {
      put();
      return;
    }
    this.motion.animate(old, [{ opacity: 1 }, { opacity: 0 }], {
      duration: swap,
      fill: 'forwards',
    });
    this.motion.after(swap, () => {
      put();
      this.motion.animate(next, [{ opacity: 0 }, { opacity: 1 }], { duration: swap });
    });
  }
}

function sameContent(a: HTMLElement, b: HTMLElement): boolean {
  return a.className === b.className && a.innerHTML === b.innerHTML;
}
