import { describe, expect, it } from 'vitest';
import { Spring } from './spring.js';

function settle(spring: Spring, maxMs = 10_000): number {
  let elapsed = 0;
  while (elapsed < maxMs) {
    elapsed += 16;
    if (spring.step(16)) return elapsed;
  }
  return elapsed;
}

describe('Spring', () => {
  it('converges to its target and snaps exactly onto it', () => {
    const s = new Spring(0);
    s.setTarget(100);
    const elapsed = settle(s);
    expect(elapsed).toBeLessThan(10_000);
    expect(s.position).toBe(100);
    expect(s.velocity).toBe(0);
  });

  it('starts settled at its initial value', () => {
    const s = new Spring(42);
    expect(s.step(16)).toBe(true);
    expect(s.position).toBe(42);
  });

  it('preserves position and velocity across a retarget (no discontinuity)', () => {
    const s = new Spring(0);
    s.setTarget(100);
    for (let i = 0; i < 5; i++) s.step(16);
    const positionBefore = s.position;
    const velocityBefore = s.velocity;
    expect(velocityBefore).toBeGreaterThan(0);

    s.setTarget(-50);
    expect(s.position).toBe(positionBefore);
    expect(s.velocity).toBe(velocityBefore);

    // The very next frame must move continuously from the old state:
    // momentum carries it forward briefly even though the target reversed.
    s.step(16);
    expect(Math.abs(s.position - positionBefore)).toBeLessThan(
      Math.abs(velocityBefore) * 0.032,
    );
    expect(settle(s)).toBeLessThan(10_000);
    expect(s.position).toBe(-50);
  });

  it('does not oscillate when critically damped or overdamped', () => {
    // critical damping: c = 2 * sqrt(k * m)
    const s = new Spring(0, { stiffness: 100, damping: 2 * Math.sqrt(100), mass: 1 });
    s.setTarget(10);
    let prev = 0;
    let overshoot = false;
    for (let i = 0; i < 600; i++) {
      if (s.step(16)) break;
      if (s.position > 10 + 0.01 || s.position < prev - 1e-9) overshoot = true;
      prev = s.position;
    }
    expect(overshoot).toBe(false);
    expect(s.position).toBe(10);
  });

  it('is frame-rate independent thanks to fixed substeps', () => {
    const a = new Spring(0);
    const b = new Spring(0);
    a.setTarget(100);
    b.setTarget(100);
    // a steps at 60fps, b at irregular chunky frames covering the same time
    for (let i = 0; i < 30; i++) a.step(16);
    for (const dt of [48, 32, 64, 16, 48, 32, 64, 16, 48, 32, 64, 16]) b.step(dt);
    expect(a.position).toBeCloseTo(b.position, 1);
  });

  it('jump() teleports without residual velocity', () => {
    const s = new Spring(0);
    s.setTarget(100);
    s.step(64);
    s.jump(7);
    expect(s.position).toBe(7);
    expect(s.velocity).toBe(0);
    expect(s.step(16)).toBe(true);
  });
});
