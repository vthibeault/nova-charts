import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Ticker } from './ticker.js';

describe('Ticker', () => {
  let now = 0;
  let pending: Array<(t: number) => void> = [];

  beforeEach(() => {
    now = 0;
    pending = [];
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
      pending.push(cb);
      return pending.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal('performance', { now: () => now });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function frame(dt: number): void {
    now += dt;
    const cbs = pending;
    pending = [];
    for (const cb of cbs) cb(now);
  }

  it('starts on first subscriber, delivers dt, stops when empty', () => {
    const t = new Ticker();
    const dts: number[] = [];
    const unsub = t.add((dt) => dts.push(dt));
    expect(pending.length).toBe(1);

    frame(16);
    expect(dts).toEqual([16]);
    frame(20);
    expect(dts).toEqual([16, 20]);

    unsub();
    frame(16);
    expect(dts.length).toBe(2);
    expect(pending.length).toBe(0); // loop stopped
  });

  it('clamps huge frame gaps (background tab) to 64ms', () => {
    const t = new Ticker();
    const dts: number[] = [];
    t.add((dt) => dts.push(dt));
    frame(5000);
    expect(dts[0]).toBe(64);
  });

  it('supports multiple subscribers on one loop', () => {
    const t = new Ticker();
    let a = 0;
    let b = 0;
    t.add(() => a++);
    t.add(() => b++);
    expect(pending.length).toBe(1);
    frame(16);
    expect(a).toBe(1);
    expect(b).toBe(1);
  });
});
