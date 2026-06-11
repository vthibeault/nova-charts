import { describe, expect, it } from 'vitest';
import { scaleLinear } from './linear.js';
import { scaleBand } from './band.js';
import { scaleTime } from './time.js';
import { ticks, niceDomain } from './ticks.js';

describe('scaleLinear', () => {
  it('maps domain to range and inverts', () => {
    const s = scaleLinear({ domain: [0, 10], range: [0, 100] });
    expect(s(0)).toBe(0);
    expect(s(5)).toBe(50);
    expect(s(10)).toBe(100);
    expect(s.invert(50)).toBe(5);
  });

  it('supports reversed ranges (SVG y-axis)', () => {
    const s = scaleLinear({ domain: [0, 10], range: [200, 0] });
    expect(s(0)).toBe(200);
    expect(s(10)).toBe(0);
    expect(s.invert(0)).toBe(10);
  });

  it('handles zero-span domains without NaN', () => {
    const s = scaleLinear({ domain: [5, 5], range: [0, 100] });
    expect(s(5)).toBe(50);
    expect(Number.isNaN(s(7))).toBe(false);
  });

  it('clamps when asked', () => {
    const s = scaleLinear({ domain: [0, 10], range: [0, 100], clamp: true });
    expect(s(-5)).toBe(0);
    expect(s(15)).toBe(100);
  });

  it('nices the domain to step boundaries', () => {
    const s = scaleLinear({ domain: [0.13, 9.87], range: [0, 100], nice: true });
    const [d0, d1] = s.domain();
    expect(d0).toBeLessThanOrEqual(0.13);
    expect(d1).toBeGreaterThanOrEqual(9.87);
    expect(d0).toBe(0);
    expect(d1).toBe(10);
  });
});

describe('ticks', () => {
  it('produces round values inside the domain', () => {
    expect(ticks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('handles tiny domains', () => {
    const t = ticks(0.0001, 0.0003, 4);
    expect(t.length).toBeGreaterThan(1);
    for (const v of t) {
      expect(v).toBeGreaterThanOrEqual(0.0001 - 1e-12);
      expect(v).toBeLessThanOrEqual(0.0003 + 1e-12);
    }
  });

  it('handles negative-crossing domains', () => {
    const t = ticks(-37, 42, 5);
    expect(t).toContain(0);
    expect(t[0]!).toBeGreaterThanOrEqual(-37);
    expect(t[t.length - 1]!).toBeLessThanOrEqual(42);
  });

  it('handles degenerate equal endpoints', () => {
    expect(ticks(3, 3)).toEqual([3]);
  });

  it('niceDomain expands outward', () => {
    const [lo, hi] = niceDomain(0.13, 9.87);
    expect(lo).toBeLessThanOrEqual(0.13);
    expect(hi).toBeGreaterThanOrEqual(9.87);
  });
});

describe('scaleBand', () => {
  it('computes bandwidth, step and positions', () => {
    const s = scaleBand({
      domain: ['a', 'b', 'c'],
      range: [0, 300],
      paddingInner: 0.2,
      paddingOuter: 0.1,
    });
    // span = step * (3 - 0.2 + 0.2) = step * 3 => step = 100
    expect(s.step()).toBeCloseTo(100);
    expect(s.bandwidth()).toBeCloseTo(80);
    expect(s('a')).toBeCloseTo(10);
    expect(s('b')).toBeCloseTo(110);
    expect(s.center('a')).toBeCloseTo(50);
  });

  it('indexAt maps pixels back to bands, clamped', () => {
    const s = scaleBand({ domain: ['a', 'b', 'c'], range: [0, 300] });
    expect(s.indexAt(s.center('b'))).toBe(1);
    expect(s.indexAt(-50)).toBe(0);
    expect(s.indexAt(999)).toBe(2);
  });

  it('returns NaN for unknown values', () => {
    const s = scaleBand({ domain: ['a'], range: [0, 100] });
    expect(Number.isNaN(s('zzz'))).toBe(true);
  });
});

describe('scaleTime', () => {
  it('maps dates linearly', () => {
    const d0 = new Date(2026, 0, 1);
    const d1 = new Date(2026, 0, 11);
    const s = scaleTime({ domain: [d0, d1], range: [0, 100] });
    expect(s(d0)).toBe(0);
    expect(s(d1)).toBe(100);
    expect(s(new Date(2026, 0, 6))).toBeCloseTo(50);
    expect(s.invert(50).getTime()).toBeCloseTo(new Date(2026, 0, 6).getTime(), -4);
  });

  it('picks day ticks for a ~week domain', () => {
    const s = scaleTime({
      domain: [new Date(2026, 0, 1), new Date(2026, 0, 8)],
      range: [0, 700],
    });
    const t = s.ticks(7);
    expect(t.length).toBeGreaterThanOrEqual(5);
    for (const d of t) {
      expect(d.getHours()).toBe(0); // aligned to day boundaries
    }
  });

  it('picks month ticks for a ~year domain', () => {
    const s = scaleTime({
      domain: [new Date(2025, 0, 1), new Date(2026, 0, 1)],
      range: [0, 700],
    });
    const t = s.ticks(12);
    expect(t.length).toBeGreaterThanOrEqual(6);
    for (const d of t) {
      expect(d.getDate()).toBe(1); // aligned to month starts
    }
  });
});
