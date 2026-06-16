import { describe, expect, it } from 'vitest';
import {
  mulberry32,
  triangularSample,
  topoOrder,
  simulateSchedule,
  percentile,
  density,
} from './montecarlo.js';

describe('mulberry32', () => {
  it('is deterministic for a seed and spans [0,1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 100 }, () => a());
    const ys = Array.from({ length: 100 }, () => b());
    expect(xs).toEqual(ys);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('triangularSample', () => {
  it('stays within [a, c] and respects the mode', () => {
    let sum = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) {
      const v = triangularSample(2, 5, 11, (i + 0.5) / N);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(11);
      sum += v;
    }
    // Triangular mean = (a+b+c)/3 = 6.
    expect(sum / N).toBeCloseTo(6, 0);
  });

  it('degenerates safely when a == c', () => {
    expect(triangularSample(4, 4, 4, 0.3)).toBe(4);
  });
});

describe('topoOrder', () => {
  it('orders predecessors before dependents', () => {
    const order = topoOrder([
      { id: 'c', optimistic: 1, likely: 1, pessimistic: 1, dependsOn: ['b'] },
      { id: 'a', optimistic: 1, likely: 1, pessimistic: 1 },
      { id: 'b', optimistic: 1, likely: 1, pessimistic: 1, dependsOn: ['a'] },
    ]);
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
  });

  it('does not hang on cycles', () => {
    const order = topoOrder([
      { id: 'x', optimistic: 1, likely: 1, pessimistic: 1, dependsOn: ['y'] },
      { id: 'y', optimistic: 1, likely: 1, pessimistic: 1, dependsOn: ['x'] },
    ]);
    expect(order.sort()).toEqual(['x', 'y']);
  });
});

describe('simulateSchedule', () => {
  const chain = [
    { id: 'a', optimistic: 2, likely: 4, pessimistic: 6 },
    { id: 'b', optimistic: 3, likely: 5, pessimistic: 7, dependsOn: ['a'] },
    { id: 'c', optimistic: 1, likely: 2, pessimistic: 9, dependsOn: ['b'] },
  ];

  it('finish times compound along the chain (later tasks finish later)', () => {
    const r = simulateSchedule(chain, { iterations: 1000, seed: 7 });
    const a = r.tasks.get('a')!.mean;
    const b = r.tasks.get('b')!.mean;
    const c = r.tasks.get('c')!.mean;
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    // Chain means ~ 4, 4+5=9, 9+4=13.
    expect(a).toBeCloseTo(4, 0);
    expect(c).toBeCloseTo(13, 0);
  });

  it('is reproducible for a fixed seed', () => {
    const a = simulateSchedule(chain, { iterations: 300, seed: 99 });
    const b = simulateSchedule(chain, { iterations: 300, seed: 99 });
    expect(a.project).toEqual(b.project);
  });

  it('a strict chain makes every task fully critical', () => {
    const r = simulateSchedule(chain, { iterations: 500, seed: 3 });
    // Terminal c is always on the deciding path; a and b feed it.
    expect(r.tasks.get('c')!.criticality).toBeGreaterThan(0.95);
    expect(r.tasks.get('a')!.criticality).toBeGreaterThan(0.95);
  });

  it('criticality reflects which parallel branch usually dominates', () => {
    // Two parallel branches feed a join; the long branch should be critical.
    const r = simulateSchedule(
      [
        { id: 'long', optimistic: 18, likely: 20, pessimistic: 22 },
        { id: 'short', optimistic: 2, likely: 3, pessimistic: 4 },
        { id: 'join', optimistic: 1, likely: 1, pessimistic: 1, dependsOn: ['long', 'short'] },
      ],
      { iterations: 800, seed: 11 },
    );
    expect(r.tasks.get('long')!.criticality).toBeGreaterThan(0.9);
    expect(r.tasks.get('short')!.criticality).toBeLessThan(0.1);
  });
});

describe('percentile & density', () => {
  it('percentile interpolates a sorted array', () => {
    const s = [0, 10, 20, 30, 40];
    expect(percentile(s, 0)).toBe(0);
    expect(percentile(s, 50)).toBe(20);
    expect(percentile(s, 100)).toBe(40);
  });

  it('density peaks where samples concentrate and normalizes to 1', () => {
    const samples = [...Array(100).fill(5), ...Array(10).fill(9)].sort((a, b) => a - b);
    const d = density(samples, 10, 20);
    let peak = 0;
    let peakBin = 0;
    d.forEach((v, i) => {
      if (v > peak) {
        peak = v;
        peakBin = i;
      }
    });
    expect(peak).toBeCloseTo(1, 5);
    // The mass at 5 (bin 10 of 20 over horizon 10) dominates.
    expect(peakBin).toBeGreaterThanOrEqual(9);
    expect(peakBin).toBeLessThanOrEqual(11);
  });
});
