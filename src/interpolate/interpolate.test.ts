import { describe, expect, it } from 'vitest';
import { parseColor, interpolateColor, formatRgba } from './color.js';
import { resamplePolyline } from './resample.js';
import { interpolateArray } from './array.js';
import { lerp, unlerp, clamp } from './number.js';

describe('number', () => {
  it('lerp/unlerp/clamp basics', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(unlerp(0, 10, 5)).toBe(0.5);
    expect(unlerp(3, 3, 7)).toBe(0); // zero-span guard
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('parseColor', () => {
  it('parses hex forms', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#6366f1')).toEqual({ r: 99, g: 102, b: 241, a: 1 });
    expect(parseColor('#6366f180')!.a).toBeCloseTo(0.5, 1);
    expect(parseColor('#f00c')!.a).toBeCloseTo(0.8, 1);
  });

  it('parses rgb()/rgba()', () => {
    expect(parseColor('rgb(10, 20, 30)')).toEqual({ r: 10, g: 20, b: 30, a: 1 });
    expect(parseColor('rgba(10, 20, 30, 0.4)')!.a).toBeCloseTo(0.4);
    expect(parseColor('rgb(50% 100% 0%)')).toEqual({ r: 127.5, g: 255, b: 0, a: 1 });
  });

  it('parses hsl()', () => {
    const red = parseColor('hsl(0, 100%, 50%)')!;
    expect(red.r).toBeCloseTo(255);
    expect(red.g).toBeCloseTo(0);
    const teal = parseColor('hsl(180, 100%, 25%)')!;
    expect(teal.b).toBeCloseTo(127.5);
  });

  it('rejects garbage', () => {
    expect(parseColor('not-a-color')).toBeNull();
    expect(parseColor('#12345')).toBeNull();
  });
});

describe('interpolateColor', () => {
  it('interpolates midpoints in sRGB with alpha', () => {
    const f = interpolateColor('#000000', '#ffffff');
    expect(f(0)).toBe('rgb(0, 0, 0)');
    expect(f(1)).toBe('rgb(255, 255, 255)');
    expect(f(0.5)).toBe('rgb(128, 128, 128)');
    const g = interpolateColor('rgba(0,0,0,0)', 'rgba(0,0,0,1)');
    expect(g(0.5)).toBe('rgba(0, 0, 0, 0.5)');
  });

  it('formatRgba drops alpha when opaque', () => {
    expect(formatRgba({ r: 1, g: 2, b: 3, a: 1 })).toBe('rgb(1, 2, 3)');
    expect(formatRgba({ r: 1, g: 2, b: 3, a: 0.25 })).toBe('rgba(1, 2, 3, 0.25)');
  });
});

describe('resamplePolyline', () => {
  it('preserves endpoints exactly when upsampling', () => {
    const pts = Float64Array.of(0, 0, 10, 10, 20, 0);
    const out = resamplePolyline(pts, 7);
    expect(out.length).toBe(14);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(0);
    expect(out[12]).toBe(20);
    expect(out[13]).toBe(0);
  });

  it('is the identity for same-count input', () => {
    const pts = Float64Array.of(0, 5, 10, 15, 20, 25);
    const out = resamplePolyline(pts, 3);
    expect([...out]).toEqual([...pts]);
  });

  it('downsampling preserves endpoints', () => {
    const pts = Float64Array.of(0, 0, 5, 5, 10, 0, 15, 5, 20, 0);
    const out = resamplePolyline(pts, 2);
    expect([...out]).toEqual([0, 0, 20, 0]);
  });

  it('handles a single point', () => {
    const out = resamplePolyline(Float64Array.of(3, 4), 4);
    expect([...out]).toEqual([3, 4, 3, 4, 3, 4, 3, 4]);
  });

  it('interpolates linearly between vertices', () => {
    const out = resamplePolyline(Float64Array.of(0, 0, 10, 10), 3);
    expect([...out]).toEqual([0, 0, 5, 5, 10, 10]);
  });

  it('handles empty input', () => {
    expect(resamplePolyline(new Float64Array(0), 5).length).toBe(0);
  });
});

describe('interpolateArray', () => {
  it('lerps every component', () => {
    const f = interpolateArray([0, 10], [10, 20]);
    expect([...f(0.5)]).toEqual([5, 15]);
  });
});
