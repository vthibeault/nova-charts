import { describe, expect, it } from 'vitest';
import { buildLinePath } from './line.js';
import { buildAreaPath } from './area.js';
import { buildArcPath, arcCentroid } from './arc.js';
import { curveSegments } from './curve.js';

describe('buildLinePath', () => {
  it('builds a linear path', () => {
    expect(buildLinePath(Float64Array.of(0, 0, 10, 5, 20, 0), 'linear')).toBe(
      'M0,0L10,5L20,0',
    );
  });

  it('returns empty for fewer than 2 points', () => {
    expect(buildLinePath(Float64Array.of(5, 5))).toBe('');
    expect(buildLinePath(new Float64Array(0))).toBe('');
  });

  it('catmull-rom passes through every input point', () => {
    const pts = Float64Array.of(0, 0, 10, 20, 20, 5, 30, 15);
    const d = buildLinePath(pts, 'catmull-rom');
    // Every original vertex must appear as a bezier segment endpoint.
    expect(d.startsWith('M0,0')).toBe(true);
    expect(d).toContain('10,20');
    expect(d).toContain('20,5');
    expect(d).toMatch(/30,15$/);
  });

  it('collinear points produce control points on the line', () => {
    // For y = x, every control coordinate pair must satisfy cy === cx.
    const d = curveSegments(Float64Array.of(0, 0, 10, 10, 20, 20), 'catmull-rom');
    const nums = d.match(/-?[\d.]+/g)!.map(Number);
    for (let i = 0; i < nums.length; i += 2) {
      expect(nums[i + 1]).toBeCloseTo(nums[i]!);
    }
  });

  it('step curve creates midpoint risers', () => {
    expect(buildLinePath(Float64Array.of(0, 0, 10, 10), 'step')).toBe(
      'M0,0L5,0L5,10L10,10',
    );
  });
});

describe('buildAreaPath', () => {
  it('closes down to the baseline', () => {
    expect(buildAreaPath(Float64Array.of(0, 10, 20, 5), 100, 'linear')).toBe(
      'M0,10L20,5L20,100L0,100Z',
    );
  });

  it('returns empty for fewer than 2 points', () => {
    expect(buildAreaPath(Float64Array.of(1, 2), 50)).toBe('');
  });
});

describe('buildArcPath', () => {
  it('returns empty for zero-extent slices', () => {
    expect(
      buildArcPath({ cx: 0, cy: 0, innerRadius: 20, outerRadius: 50, startAngle: 1, endAngle: 1 }),
    ).toBe('');
  });

  it('builds a quarter donut slice', () => {
    const d = buildArcPath({
      cx: 100,
      cy: 100,
      innerRadius: 40,
      outerRadius: 80,
      startAngle: 0,
      endAngle: Math.PI / 2,
    });
    // starts at top outer (100, 20), arcs to right outer (180, 100)
    expect(d).toBe('M100,20A80,80 0 0 1 180,100L140,100A40,40 0 0 0 100,60Z');
  });

  it('uses the large-arc flag past 180 degrees', () => {
    const d = buildArcPath({
      cx: 0,
      cy: 0,
      innerRadius: 10,
      outerRadius: 20,
      startAngle: 0,
      endAngle: Math.PI * 1.5,
    });
    expect(d).toContain('0 1 1'); // large-arc sweep on the outer edge
  });

  it('handles a full circle without collapsing', () => {
    const d = buildArcPath({
      cx: 0,
      cy: 0,
      innerRadius: 10,
      outerRadius: 20,
      startAngle: 0,
      endAngle: Math.PI * 2,
    });
    expect(d).not.toBe('');
    expect(d.match(/A/g)!.length).toBe(4); // two outer + two inner semicircles
  });

  it('pie (innerRadius 0) wedges from the center', () => {
    const d = buildArcPath({
      cx: 50,
      cy: 50,
      innerRadius: 0,
      outerRadius: 40,
      startAngle: 0,
      endAngle: Math.PI / 2,
    });
    expect(d.startsWith('M50,50L')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('padPx gives a constant-width gap (same offset at inner and outer radius)', () => {
    // cx=cy=0, a0=0 -> the start-edge divider is the vertical line x=0, so the
    // perpendicular gap offset of any edge point is just |x|.
    const d = buildArcPath({
      cx: 0,
      cy: 0,
      innerRadius: 40,
      outerRadius: 80,
      startAngle: 0,
      endAngle: Math.PI / 2,
      padPx: 4,
    });
    const outerStart = /^M(-?[\d.]+),/.exec(d)!;
    const innerStart = /0 (-?[\d.]+),(-?[\d.]+)Z$/.exec(d)!;
    const outerOffset = Math.abs(Number(outerStart[1]));
    const innerOffset = Math.abs(Number(innerStart[1]));
    // Both edges sit half the gap (2px) from the divider, regardless of radius.
    expect(outerOffset).toBeCloseTo(2, 1);
    expect(innerOffset).toBeCloseTo(2, 1);
  });

  it('padPx fades to nothing on slices too narrow to hold the gap', () => {
    // A sliver far narrower than the requested 8px gap must still render.
    const d = buildArcPath({
      cx: 0,
      cy: 0,
      innerRadius: 40,
      outerRadius: 80,
      startAngle: 0,
      endAngle: 0.01,
      padPx: 8,
    });
    expect(d).not.toBe('');
    expect(d).not.toMatch(/NaN/);
  });

  it('padPx on a pie wedge comes to a clean point with no inner arc', () => {
    const d = buildArcPath({
      cx: 0,
      cy: 0,
      innerRadius: 0,
      outerRadius: 80,
      startAngle: 0,
      endAngle: Math.PI / 2,
      padPx: 4,
    });
    // Outer arc then a single L to the apex, no inner arc (one 'A' total).
    expect(d.match(/A/g)!.length).toBe(1);
    expect(d).not.toMatch(/NaN/);
  });

  it('centroid sits at the angular and radial midpoint', () => {
    const [x, y] = arcCentroid({
      cx: 0,
      cy: 0,
      innerRadius: 0,
      outerRadius: 100,
      startAngle: 0,
      endAngle: Math.PI, // mid angle: 90deg -> pointing right
    });
    expect(x).toBeCloseTo(50);
    expect(y).toBeCloseTo(0);
  });
});
