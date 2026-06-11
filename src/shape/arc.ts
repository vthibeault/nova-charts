import { fmtNum as f } from './curve.js';

export interface ArcSpec {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  /** Radians; 0 points up (12 o'clock), increasing clockwise. */
  startAngle: number;
  endAngle: number;
  /** Angular gap (radians) shaved off each side of the slice. */
  padAngle?: number;
}

const TAU = Math.PI * 2;

function polar(cx: number, cy: number, r: number, angle: number): [number, number] {
  // angle 0 = up, clockwise positive (screen coordinates)
  return [cx + r * Math.sin(angle), cy - r * Math.cos(angle)];
}

/**
 * SVG path `d` for a donut/pie slice. Angles are animated values rebuilt
 * each frame — arc d-strings are never string-morphed.
 * Handles zero-extent slices and full circles.
 */
export function buildArcPath(spec: ArcSpec): string {
  const { cx, cy, innerRadius, outerRadius } = spec;
  let a0 = spec.startAngle;
  let a1 = spec.endAngle;
  if (a1 < a0) [a0, a1] = [a1, a0];

  const pad = spec.padAngle ?? 0;
  if (pad > 0 && a1 - a0 > pad * 2) {
    a0 += pad;
    a1 -= pad;
  }

  const extent = a1 - a0;
  if (extent <= 1e-6) return '';

  if (extent >= TAU - 1e-6) {
    // Full ring: two semicircle arcs (a single arc can't span 360°).
    const [ox0, oy0] = polar(cx, cy, outerRadius, 0);
    const [ox1, oy1] = polar(cx, cy, outerRadius, Math.PI);
    let d =
      `M${f(ox0)},${f(oy0)}` +
      `A${f(outerRadius)},${f(outerRadius)} 0 1 1 ${f(ox1)},${f(oy1)}` +
      `A${f(outerRadius)},${f(outerRadius)} 0 1 1 ${f(ox0)},${f(oy0)}`;
    if (innerRadius > 0) {
      const [ix0, iy0] = polar(cx, cy, innerRadius, 0);
      const [ix1, iy1] = polar(cx, cy, innerRadius, Math.PI);
      d +=
        `M${f(ix0)},${f(iy0)}` +
        `A${f(innerRadius)},${f(innerRadius)} 0 1 0 ${f(ix1)},${f(iy1)}` +
        `A${f(innerRadius)},${f(innerRadius)} 0 1 0 ${f(ix0)},${f(iy0)}`;
    }
    return d + 'Z';
  }

  const largeArc = extent > Math.PI ? 1 : 0;
  const [sox, soy] = polar(cx, cy, outerRadius, a0);
  const [eox, eoy] = polar(cx, cy, outerRadius, a1);

  if (innerRadius <= 0) {
    return (
      `M${f(cx)},${f(cy)}` +
      `L${f(sox)},${f(soy)}` +
      `A${f(outerRadius)},${f(outerRadius)} 0 ${largeArc} 1 ${f(eox)},${f(eoy)}` +
      'Z'
    );
  }

  const [six, siy] = polar(cx, cy, innerRadius, a0);
  const [eix, eiy] = polar(cx, cy, innerRadius, a1);
  return (
    `M${f(sox)},${f(soy)}` +
    `A${f(outerRadius)},${f(outerRadius)} 0 ${largeArc} 1 ${f(eox)},${f(eoy)}` +
    `L${f(eix)},${f(eiy)}` +
    `A${f(innerRadius)},${f(innerRadius)} 0 ${largeArc} 0 ${f(six)},${f(siy)}` +
    'Z'
  );
}

/** Midpoint of a slice — anchor for labels and hover offsets. */
export function arcCentroid(spec: ArcSpec): [number, number] {
  const mid = (spec.startAngle + spec.endAngle) / 2;
  const r = (spec.innerRadius + spec.outerRadius) / 2;
  return polar(spec.cx, spec.cy, r, mid);
}
