import { svgEl } from '../core/svg.js';
import { keyedJoin, type JoinItem } from '../core/join.js';
import { AnimatedValue } from '../motion/animated.js';
import type { SpringConfig } from '../motion/spring.js';
import type { Rect } from '../core/types.js';

export interface GridLineSpec {
  key: string;
  /** Pixel position perpendicular to the line (y for horizontal lines). */
  pos: number;
}

interface LineItem extends JoinItem {
  line: SVGLineElement;
  pos: AnimatedValue;
  opacity: AnimatedValue;
  remove?: () => void;
}

/** Horizontal grid lines that glide with the y-domain (keyed like axis ticks). */
export class Grid {
  private g: SVGGElement;
  private items = new Map<string, LineItem>();

  constructor(parent: SVGElement, private spring: Partial<SpringConfig> = {}) {
    this.g = svgEl('g', { class: 'nova-grid' }, parent);
  }

  update(lines: GridLineSpec[], plot: Rect, immediate: boolean): void {
    keyedJoin(this.items, lines.map((l) => [l.key, l] as const), {
      enter: (_key, l) => {
        const line = svgEl(
          'line',
          { x1: plot.x, x2: plot.x + plot.width, transform: `translate(0, ${l.pos})` },
          this.g,
        );
        const pos = new AnimatedValue(l.pos, this.spring);
        const opacity = new AnimatedValue(0, this.spring);
        const item: LineItem = { line, pos, opacity };
        pos.onChange((v) => line.setAttribute('transform', `translate(0, ${v})`));
        opacity.onChange((v) => {
          line.setAttribute('opacity', String(Math.max(v, 0)));
          if (item.exiting && v < 0.02) {
            line.remove();
            item.remove?.();
          }
        });
        opacity.set(1, { immediate });
        return item;
      },
      update: (item, l) => {
        item.line.setAttribute('x1', String(plot.x));
        item.line.setAttribute('x2', String(plot.x + plot.width));
        item.pos.set(l.pos, { immediate });
        item.opacity.set(1, { immediate });
      },
      exit: (item, remove) => {
        item.remove = remove;
        if (immediate) {
          item.line.remove();
          remove();
        } else {
          item.opacity.set(0);
        }
      },
    });
  }

  destroy(): void {
    for (const item of this.items.values()) {
      item.pos.destroy();
      item.opacity.destroy();
    }
    this.items.clear();
    this.g.remove();
  }
}
