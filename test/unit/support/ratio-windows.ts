// Shared by the Session 343 clock rows (`s343-cell-option-lines-rows.test.ts`, `s343-completion-context-rows.test.ts`): a ratio of one piece of work to a baseline, each read in its own window of a clock, round after round. The
// rows' own copies of the helper's rows are in the first of those files (Learning 910: a clock row's own clock is pinned).

/** What `ratioOfWindows` read. */
export interface Windows {
  /** The median over the rounds of (work window / its repeats) over (baseline window / its repeats). */
  ratio: number;
  /** The smallest window of either kind, in milliseconds: 0 or less is a clock that did not tick. */
  smallestWindowMs: number;
  rounds: number;
}

/**
 * Times, round after round, `workRepeats` repeats of `work` and `baselineRepeats` repeats of `baseline`, each in its own window of `now`, and reports the median ratio of one unit of work to one unit of baseline. `now` is
 * the clock in milliseconds: the rows run it on `performance.now()`, the helper's own rows on a clock only the stand-ins advance. The median round decides, so a pause in one window does not.
 */
export function ratioOfWindows(work: () => void, workRepeats: number, baseline: () => void, baselineRepeats: number, rounds: number, now: () => number = () => performance.now()): Windows {
  const ratios: number[] = [];
  let smallest = Infinity;
  for (let round = 0; round < rounds; round++) {
    const t0 = now();
    for (let i = 0; i < workRepeats; i++) work();
    const t1 = now();
    for (let i = 0; i < baselineRepeats; i++) baseline();
    const t2 = now();
    smallest = Math.min(smallest, t1 - t0, t2 - t1);
    ratios.push((t1 - t0) / workRepeats / ((t2 - t1) / baselineRepeats));
  }
  ratios.sort((a, b) => a - b);
  return { ratio: ratios[Math.floor(ratios.length / 2)], smallestWindowMs: smallest, rounds };
}

/**
 * `[]` is a run that keeps the criterion: a clock that ticked in every window, and a median ratio under the limit. A window that did not tick keeps nothing (a clock stuck at 0 makes every ratio 0/0 or true). `what` names
 * the work and the baseline in the message: "three warm calls took 7 times one lookup, not under 100 times".
 */
export function clockBreaks(run: Windows, ratioLimit: number, what: string): string[] {
  if (!(run.smallestWindowMs > 0)) return [`a window of the clock did not tick (the smallest was ${run.smallestWindowMs} ms)`];
  if (!Number.isFinite(run.ratio)) return [`the ratio is ${run.ratio}`];
  return run.ratio < ratioLimit ? [] : [`${what}: ${run.ratio.toFixed(2)} times, not under ${ratioLimit} times`];
}

/** A stand-in that spins `ms` milliseconds on the real clock. */
export const spinning = (ms: number) => (): void => {
  const started = performance.now();
  while (performance.now() - started < ms) {
    /* spin */
  }
};
