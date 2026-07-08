import { describe, expect, it } from 'vitest';
import { driftStat, planAt, type DriftTask } from './drift.js';

const hist = (pairs: [number, number][]): { at: number; finish: number }[] =>
  pairs.map(([at, finish]) => ({ at, finish }));

describe('planAt', () => {
  it('is a step function of the re-plan history', () => {
    const h = hist([
      [0, 20],
      [10, 24],
      [20, 30],
    ]);
    expect(planAt(h, -5)).toBe(20); // before the first re-plan: first promise
    expect(planAt(h, 0)).toBe(20);
    expect(planAt(h, 9.9)).toBe(20);
    expect(planAt(h, 10)).toBe(24);
    expect(planAt(h, 15)).toBe(24);
    expect(planAt(h, 100)).toBe(30);
  });

  it('sorts unordered history and handles empty', () => {
    expect(planAt(hist([[10, 24], [0, 20]]), 5)).toBe(20);
    expect(planAt([], 5)).toBe(0);
  });
});

describe('driftStat', () => {
  it('a stable plan has zero velocity and honest = promised', () => {
    const t: DriftTask = { id: 'a', history: hist([[0, 30], [10, 30], [20, 30]]) };
    const s = driftStat(t);
    expect(s.velocity).toBe(0);
    expect(s.honest).toBe(30);
    expect(s.slip).toBe(0);
    expect(s.runaway).toBe(false);
  });

  it('linear slip converges to the exact fixed point', () => {
    // finish = 20 + 0.5·t → fixed point t* = 20 / (1 − 0.5) = 40.
    const t: DriftTask = { id: 'a', history: hist([[0, 20], [10, 25], [20, 30]]) };
    const s = driftStat(t);
    expect(s.velocity).toBeCloseTo(0.5, 6);
    expect(s.honest).toBeCloseTo(40, 6);
    expect(s.r2).toBeCloseTo(1, 6);
    expect(s.slip).toBe(10);
    expect(s.runaway).toBe(false);
  });

  it('velocity ≥ 1 is a runaway: the promise never lands', () => {
    // Each day of elapsed time pushes the finish out by 1.2 days.
    const t: DriftTask = { id: 'a', history: hist([[0, 20], [10, 32], [20, 44]]) };
    const s = driftStat(t);
    expect(s.velocity).toBeCloseTo(1.2, 6);
    expect(s.runaway).toBe(true);
    expect(s.honest).toBe(Infinity);
  });

  it('a recovering plan forecasts earlier than the promise, floored at the last report', () => {
    // finish = 40 − 0.5·t → fixed point 40 / 1.5 ≈ 26.67, after lastAt 20.
    const t: DriftTask = { id: 'a', history: hist([[0, 40], [10, 35], [20, 30]]) };
    const s = driftStat(t);
    expect(s.velocity).toBeCloseTo(-0.5, 6);
    expect(s.honest).toBeCloseTo(40 / 1.5, 4);
    expect(s.honest).toBeLessThan(s.promised);
    expect(s.honest).toBeGreaterThanOrEqual(20);
  });

  it('scrubbing upTo replays the story: stable early, slipping late', () => {
    const t: DriftTask = {
      id: 'a',
      history: hist([[0, 30], [10, 30], [20, 38], [30, 46]]),
    };
    const early = driftStat(t, 10);
    expect(early.velocity).toBe(0);
    expect(early.honest).toBe(30);
    const late = driftStat(t, 30);
    expect(late.velocity).toBeGreaterThan(0.4);
    expect(late.honest).toBeGreaterThan(46);
  });

  it('an actual finish inside the window wins: honest = actual, done = true', () => {
    const t: DriftTask = { id: 'a', history: hist([[0, 20], [10, 25]]), actual: 27 };
    expect(driftStat(t, 5).done).toBe(false);
    const s = driftStat(t, 30);
    expect(s.done).toBe(true);
    expect(s.honest).toBe(27);
    expect(s.runaway).toBe(false);
  });

  it('a single point (or upTo before all history) degrades gracefully', () => {
    const t: DriftTask = { id: 'a', history: hist([[10, 25]]) };
    const s = driftStat(t, 0); // window empty → falls back to the first point
    expect(s.n).toBe(1);
    expect(s.velocity).toBe(0);
    expect(s.honest).toBe(25);
  });

  it('honest never lands before an already-made promise while slipping', () => {
    // Mild positive drift with the fixed point behind the latest promise.
    const t: DriftTask = { id: 'a', history: hist([[0, 50], [10, 51], [20, 52]]) };
    const s = driftStat(t);
    expect(s.velocity).toBeCloseTo(0.1, 6);
    expect(s.honest).toBeGreaterThanOrEqual(52);
  });
});
