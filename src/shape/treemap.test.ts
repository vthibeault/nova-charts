import { describe, expect, it } from 'vitest';
import { squarify } from './treemap.js';

const bounds = { x: 0, y: 0, width: 100, height: 100 };

describe('squarify', () => {
  it('areas are proportional to values and fill the bounds', () => {
    const cells = squarify(
      [
        { key: 'a', value: 6 },
        { key: 'b', value: 3 },
        { key: 'c', value: 1 },
      ],
      bounds,
    );
    const area = (k: string): number => {
      const r = cells.find((c) => c.key === k)!.rect;
      return r.width * r.height;
    };
    expect(area('a')).toBeCloseTo(6000, 0);
    expect(area('b')).toBeCloseTo(3000, 0);
    expect(area('c')).toBeCloseTo(1000, 0);
    expect(area('a') + area('b') + area('c')).toBeCloseTo(10000, 0);
  });

  it('cells stay inside the bounds and do not overlap', () => {
    const cells = squarify(
      Array.from({ length: 7 }, (_, i) => ({ key: String(i), value: i + 1 })),
      bounds,
    );
    for (const c of cells) {
      expect(c.rect.x).toBeGreaterThanOrEqual(-1e-6);
      expect(c.rect.y).toBeGreaterThanOrEqual(-1e-6);
      expect(c.rect.x + c.rect.width).toBeLessThanOrEqual(100 + 1e-6);
      expect(c.rect.y + c.rect.height).toBeLessThanOrEqual(100 + 1e-6);
    }
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i]!.rect;
        const b = cells[j]!.rect;
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        expect(Math.min(overlapX, overlapY)).toBeLessThanOrEqual(1e-6);
      }
    }
  });

  it('preserves input order and zero values get empty rects', () => {
    const cells = squarify(
      [
        { key: 'x', value: 0 },
        { key: 'y', value: 10 },
      ],
      bounds,
    );
    expect(cells.map((c) => c.key)).toEqual(['x', 'y']);
    expect(cells[0]!.rect.width).toBe(0);
    expect(cells[1]!.rect.width * cells[1]!.rect.height).toBeCloseTo(10000, 0);
  });

  it('handles empty input and zero totals', () => {
    expect(squarify([], bounds)).toEqual([]);
    const cells = squarify([{ key: 'a', value: 0 }], bounds);
    expect(cells[0]!.rect.width).toBe(0);
  });
});
