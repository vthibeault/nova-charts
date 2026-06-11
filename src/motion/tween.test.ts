import { describe, expect, it } from 'vitest';
import { Tween } from './tween.js';
import { linear } from './easing.js';

describe('Tween', () => {
  it('hits exact endpoints', () => {
    const t = new Tween({ from: 0, to: 10, duration: 100, easing: linear });
    expect(t.value).toBe(0);
    t.step(50);
    expect(t.value).toBeCloseTo(5);
    expect(t.step(50)).toBe(true);
    expect(t.value).toBe(10);
  });

  it('clamps overshooting steps to the final value', () => {
    const t = new Tween({ from: 0, to: 10, duration: 100, easing: linear });
    expect(t.step(1000)).toBe(true);
    expect(t.value).toBe(10);
  });

  it('respects delay before starting', () => {
    const t = new Tween({ from: 0, to: 10, duration: 100, easing: linear, delay: 50 });
    t.step(25);
    expect(t.value).toBe(0);
    t.step(50); // 25ms past the delay
    expect(t.value).toBeCloseTo(2.5);
  });

  it('retargets continuously from the current value', () => {
    const t = new Tween({ from: 0, to: 10, duration: 100, easing: linear });
    t.step(50);
    const mid = t.value;
    t.retarget(0);
    expect(t.value).toBe(mid); // no jump at the retarget instant
    t.step(100);
    expect(t.value).toBe(0);
  });
});
