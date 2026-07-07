/**
 * Plan-drift analysis — the math behind the Chronicle chart.
 *
 * Every re-plan of a schedule leaves a record: "as of day `at`, we promised to
 * finish on day `finish`". Traditional tools throw that history away and show
 * only the latest promise. This module keeps it and asks the questions the
 * history can answer:
 *
 * - `planAt` — what did the plan say on any given day? (a step function)
 * - `driftStat` — how fast is the promise moving (velocity, in days of slip
 *   per day elapsed), and where does the trend actually land?
 *
 * The "honest finish" is the fixed point of the fitted promise line: fit
 * finish(t) = a + v·t over the report dates, then solve finish(t*) = t*, i.e.
 * t* = a / (1 − v). It is the day the promise stops receding — the date the
 * task is *actually* heading for. When v ≥ 1 the promise recedes at least as
 * fast as time passes: the lines never cross and the task is a *runaway*
 * (honest = Infinity) until something structural changes.
 */

export interface DriftPoint {
  /** Report (re-plan) date, in any consistent unit (project days, ms, …). */
  at: number;
  /** The finish the plan promised as of that date, in the same unit. */
  finish: number;
}

export interface DriftTask {
  id: string;
  name?: string;
  /** Plan history, one point per re-plan. Order does not matter. */
  history: DriftPoint[];
  /** Actual finish, once the task really completed. */
  actual?: number;
  color?: string;
}

export interface DriftStat {
  /** Slope of the fitted promise line: days of slip per day elapsed. */
  velocity: number;
  /** R² of the fit — how systematic (vs noisy) the drift is, 0..1. */
  r2: number;
  /** First promise in the window considered. */
  original: number;
  /** Latest promise in the window considered. */
  promised: number;
  /** promised − original. */
  slip: number;
  /**
   * The drift-adjusted forecast (see module docs). Never earlier than the last
   * report date; equals `actual` once the task is done; Infinity when runaway.
   */
  honest: number;
  /** True when velocity ≥ ~1: the promise recedes as fast as time passes. */
  runaway: boolean;
  /** True when `actual` falls inside the window considered. */
  done: boolean;
  /** Number of history points the stats were computed from. */
  n: number;
}

/** Velocity at/above which the fixed point stops being meaningful. */
const RUNAWAY_VELOCITY = 0.98;

const byAt = (a: DriftPoint, b: DriftPoint): number => a.at - b.at;

/**
 * The promise in force on day `t`: the finish of the latest re-plan at or
 * before `t` (before the first re-plan, the first promise).
 */
export function planAt(history: DriftPoint[], t: number): number {
  const pts = [...history].sort(byAt);
  if (pts.length === 0) return 0;
  let cur = pts[0]!.finish;
  for (const p of pts) {
    if (p.at > t) break;
    cur = p.finish;
  }
  return cur;
}

/**
 * Drift statistics over the history up to (and including) `upTo` — pass the
 * scrub time to watch the stats evolve as the history replays.
 */
export function driftStat(task: DriftTask, upTo = Infinity): DriftStat {
  const all = [...task.history].sort(byAt);
  let pts = all.filter((p) => p.at <= upTo);
  if (pts.length === 0) pts = all.slice(0, 1);

  const n = pts.length;
  const original = pts[0]?.finish ?? 0;
  const promised = pts[n - 1]?.finish ?? 0;
  const lastAt = pts[n - 1]?.at ?? 0;
  const done = task.actual !== undefined && task.actual <= upTo;

  let velocity = 0;
  let r2 = 0;
  if (n >= 2) {
    let sumT = 0;
    let sumF = 0;
    for (const p of pts) {
      sumT += p.at;
      sumF += p.finish;
    }
    const mt = sumT / n;
    const mf = sumF / n;
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (const p of pts) {
      sxx += (p.at - mt) * (p.at - mt);
      sxy += (p.at - mt) * (p.finish - mf);
      syy += (p.finish - mf) * (p.finish - mf);
    }
    if (sxx > 0) {
      velocity = sxy / sxx;
      if (syy > 0) {
        const ssRes = syy - (sxy * sxy) / sxx;
        r2 = Math.max(0, Math.min(1, 1 - ssRes / syy));
      }
    }
  }

  const runaway = !done && velocity >= RUNAWAY_VELOCITY;
  let honest: number;
  if (done) {
    honest = task.actual!;
  } else if (runaway) {
    honest = Infinity;
  } else if (n < 2 || velocity === 0) {
    honest = promised;
  } else {
    // Fixed point of finish(t) = a + v·t, anchored through the fitted line.
    const mt = pts.reduce((s, p) => s + p.at, 0) / n;
    const mf = pts.reduce((s, p) => s + p.finish, 0) / n;
    const a = mf - velocity * mt;
    honest = a / (1 - velocity);
    // A forecast can't land before the last report (or before the promise
    // already made, when the trend is still slipping).
    honest = Math.max(honest, lastAt);
    if (velocity > 0) honest = Math.max(honest, promised);
  }

  return { velocity, r2, original, promised, slip: promised - original, honest, runaway, done, n };
}
