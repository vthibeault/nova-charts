import { Chart, type UpdateReason } from '../core/chart.js';
import type { BaseChartOptions, ChartData } from '../core/types.js';
import { svgEl } from '../core/svg.js';
import { keyedJoin, type JoinItem } from '../core/join.js';
import { AnimatedValue } from '../motion/animated.js';
import { scaleLinear, type LinearScale } from '../scale/linear.js';
import { scaleBand, type BandScale } from '../scale/band.js';
import { Axis } from '../component/axis.js';
import { Grid } from '../component/grid.js';
import { Tooltip } from '../component/tooltip.js';
import { vecToRgba, type RGBA } from '../interpolate/color.js';
import { clamp } from '../interpolate/number.js';
import { driftStat, planAt, type DriftStat, type DriftTask } from '../analysis/drift.js';

export interface ChronicleChartOptions extends Omit<BaseChartOptions, 'data'> {
  tasks: DriftTask[];
  /** Format day numbers as calendar dates from this start. */
  startDate?: Date;
  /** Upper scrub bound ("today"). Default: latest report/actual in the data. */
  today?: number;
  /** Optional target-finish line. */
  deadline?: number;
  /** Replay the whole plan history as the entrance (default true). */
  replay?: boolean;
  data?: ChartData;
}

const DAY = 86_400_000;
const GREEN: RGBA = { r: 52, g: 211, b: 153, a: 1 };
const AMBER: RGBA = { r: 251, g: 191, b: 36, a: 1 };
const RED: RGBA = { r: 251, g: 113, b: 133, a: 1 };

const mix = (a: RGBA, b: RGBA, t: number): RGBA => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
  a: 1,
});

/** Status color for a drift velocity: calm green → slipping amber → red. */
function velocityColor(stat: DriftStat): RGBA {
  if (stat.done) return GREEN;
  if (stat.runaway) return RED;
  const v = clamp(stat.velocity, 0, 0.9);
  return v < 0.35 ? mix(GREEN, AMBER, v / 0.35) : mix(AMBER, RED, (v - 0.35) / 0.55);
}

interface RowItem extends JoinItem {
  g: SVGGElement;
  label: SVGTextElement;
  diagonal: SVGLineElement;
  comet: SVGPolylineElement;
  dots: SVGCircleElement[];
  head: SVGPathElement;
  honest: SVGGElement;
  honestLink: SVGLineElement;
  edgeGlyph: SVGTextElement;
  bang: SVGTextElement;
  doneDot: SVGCircleElement;
  /** Comet points and cumulative polyline length at each snapshot. */
  pts: { at: number; x: number; y: number }[];
  cum: number[];
  total: number;
  task: DriftTask;
  removeFn: (() => void) | null;
}

/**
 * Chronicle — the plan time-machine. Every other PM chart shows the *current*
 * plan and forgets every plan before it; Chronicle keeps each re-plan as a
 * frame and lets you scrub through your project's history.
 *
 * Inside each task's row band, vertical position is the report date and
 * horizontal position the promised finish, so every task draws a **drift
 * comet**: a calm task falls straight down, a slipping one slants right, an
 * accelerating one curves away. The faint in-band diagonal is the *reality
 * line* (promise = report date) — a task is done when its comet reaches it,
 * and extending the comet's fitted trajectory to that diagonal is, both
 * geometrically and algebraically, the **honest finish** — the date the task
 * is actually heading for (⌖). A comet steeper than the diagonal never meets
 * it: a *runaway* (∞). Scrub anywhere to replay; the entrance replays the
 * whole history on mount.
 */
export class ChronicleChart extends Chart<ChronicleChartOptions & { data: ChartData }> {
  private gridLayer: SVGGElement;
  private rowLayer: SVGGElement;
  private chromeLayer: SVGGElement;
  private axisLayer: SVGGElement;
  private xAxis: Axis;
  private grid: Grid;
  private tooltip: Tooltip | null = null;
  private nowLine: SVGLineElement;
  private nowLabel: SVGTextElement;
  private headline: SVGTextElement;
  private deadlineLine: SVGLineElement;
  private tau: AnimatedValue;
  private items = new Map<string, RowItem>();
  private xScale!: LinearScale;
  private yBand!: BandScale;
  private t0 = 0;
  private tEnd = 1;
  private scrubbing = false;
  private hoveredId: string | null = null;
  private detach: Array<() => void> = [];

  constructor(el: HTMLElement, options: ChronicleChartOptions) {
    super(el, { ...options, data: options.data ?? { series: [] } });
    this.gridLayer = svgEl('g', {}, this.svg);
    this.rowLayer = svgEl('g', {}, this.svg);
    this.chromeLayer = svgEl('g', {}, this.svg);
    this.axisLayer = svgEl('g', {}, this.svg);
    this.xAxis = new Axis(this.axisLayer, 'bottom', this.springConfig());
    this.grid = new Grid(this.gridLayer, this.springConfig(), 'vertical');
    this.deadlineLine = svgEl(
      'line',
      { stroke: 'var(--nova-c5)', 'stroke-width': 1.5, 'stroke-dasharray': '5,4', opacity: 0 },
      this.chromeLayer,
    );
    this.nowLine = svgEl(
      'line',
      { stroke: 'var(--nova-c1)', 'stroke-width': 1.5, opacity: 0.9 },
      this.chromeLayer,
    );
    this.nowLabel = svgEl(
      'text',
      { fill: 'var(--nova-c1)', 'font-size': 11, 'font-weight': 700, 'text-anchor': 'middle' },
      this.chromeLayer,
    );
    this.headline = svgEl(
      'text',
      { fill: 'var(--nova-fg)', 'font-size': 12, 'font-weight': 600, 'text-anchor': 'end' },
      this.chromeLayer,
    );
    // The scrub time is itself a spring — every derived mark inherits its motion.
    this.tau = new AnimatedValue(0, { stiffness: 60, damping: 18 });
    this.tau.onChange(() => this.applyTau());
    if (options.tooltip !== false) this.tooltip = new Tooltip(this.overlay);
    this.bindPointer();
    this.bootstrap();
    if (this.options.replay !== false && !this.immediate()) this.replay();
    else this.tau.set(this.tEnd, { immediate: true });
  }

  // ---- public API -----------------------------------------------------------

  /** The scrub position (as-of day) the chart is heading to. */
  asOf(): number {
    return this.tau.target;
  }

  /** Scrub to a day; the chart glides there (or jumps with immediate). */
  setAsOf(day: number, immediate = false): void {
    this.tau.set(clamp(day, this.t0, this.tEnd), { immediate: immediate || this.immediate() });
  }

  /** Rewind to the first re-plan and play the whole history forward. */
  replay(): void {
    this.tau.set(this.t0, { immediate: true });
    this.tau.set(this.tEnd);
    this.announcer.announce('Replaying plan history');
  }

  /** Drift statistics for one task as of a day (default: current scrub). */
  statAt(id: string, day = this.tau.target): DriftStat | null {
    const task = this.options.tasks.find((t) => t.id === id);
    return task ? driftStat(task, day) : null;
  }

  setTasks(tasks: DriftTask[]): void {
    this.options.tasks = tasks;
    this.update('data');
    this.announcer.announce('Plan history updated');
  }

  protected override chartType(): string {
    return 'Chronicle';
  }

  protected override ariaLabel(): string {
    return this.options.ariaLabel ?? `Chronicle plan-history chart, ${this.options.tasks.length} tasks`;
  }

  // ---- layout ---------------------------------------------------------------

  protected override update(reason: UpdateReason): void {
    const immediate = this.immediate() || reason === 'resize';
    const tasks = this.options.tasks;

    let t0 = Infinity;
    let tEnd = -Infinity;
    let xMax = -Infinity;
    for (const t of tasks) {
      for (const p of t.history) {
        t0 = Math.min(t0, p.at);
        tEnd = Math.max(tEnd, p.at);
        xMax = Math.max(xMax, p.finish);
      }
      if (t.actual !== undefined) {
        tEnd = Math.max(tEnd, t.actual);
        xMax = Math.max(xMax, t.actual);
      }
    }
    if (!Number.isFinite(t0)) {
      t0 = 0;
      tEnd = 1;
      xMax = 1;
    }
    this.t0 = t0;
    this.tEnd = this.options.today ?? tEnd;
    if (this.options.deadline !== undefined) xMax = Math.max(xMax, this.options.deadline);
    // Leave forecast room: finite honest finishes up to half a span beyond.
    const span = Math.max(xMax - t0, 1);
    for (const t of tasks) {
      const h = driftStat(t, this.tEnd).honest;
      if (Number.isFinite(h)) xMax = Math.max(xMax, Math.min(h, xMax + span * 0.5));
    }

    this.xScale = scaleLinear({
      domain: [t0, xMax + span * 0.06],
      range: [this.plot.x, this.plot.x + this.plot.width],
    });
    this.yBand = scaleBand({
      domain: tasks.map((t) => t.id),
      range: [this.plot.y + 18, this.plot.y + this.plot.height],
      paddingInner: 0.42,
      paddingOuter: 0.15,
    });

    const ticks = this.xScale.ticks(Math.max(3, Math.floor(this.plot.width / 90)));
    const tickSpecs = ticks.map((d) => ({ key: String(d), label: this.fmtDay(d), pos: this.xScale(d) }));
    this.xAxis.update(tickSpecs, this.plot, immediate);
    this.grid.update(
      ticks.map((d) => ({ key: String(d), pos: this.xScale(d) })),
      this.plot,
      immediate,
    );

    if (this.options.deadline !== undefined) {
      const dx = this.xScale(this.options.deadline);
      this.deadlineLine.setAttribute('x1', String(dx));
      this.deadlineLine.setAttribute('x2', String(dx));
      this.deadlineLine.setAttribute('y1', String(this.plot.y + 14));
      this.deadlineLine.setAttribute('y2', String(this.plot.y + this.plot.height));
      this.deadlineLine.setAttribute('opacity', '0.75');
    } else {
      this.deadlineLine.setAttribute('opacity', '0');
    }
    this.nowLine.setAttribute('y1', String(this.plot.y + 14));
    this.nowLine.setAttribute('y2', String(this.plot.y + this.plot.height));
    this.nowLabel.setAttribute('y', String(this.plot.y + 8));
    this.headline.setAttribute('x', String(this.plot.x + this.plot.width));
    this.headline.setAttribute('y', String(this.plot.y + 8));

    this.buildRows();
    this.tau.set(clamp(this.tau.target, this.t0, this.tEnd), { immediate: true });
    this.applyTau();
  }

  private buildRows(): void {
    keyedJoin(
      this.items,
      this.options.tasks.map((t) => [t.id, t] as const),
      {
        enter: (_key, task) => {
          const g = svgEl('g', {}, this.rowLayer);
          const label = svgEl(
            'text',
            {
              fill: 'var(--nova-fg-muted)', 'font-size': 11, 'font-weight': 600,
              'paint-order': 'stroke', stroke: 'var(--nova-tooltip-bg, #0f1626)', 'stroke-width': 3,
            },
            g,
          );
          label.textContent = task.name ?? task.id;
          const diagonal = svgEl(
            'line',
            { stroke: 'var(--nova-fg-muted)', 'stroke-width': 1, 'stroke-dasharray': '2,3', opacity: 0.4 },
            g,
          );
          const comet = svgEl(
            'polyline',
            { fill: 'none', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' },
            g,
          ) as SVGPolylineElement;
          const honestLink = svgEl(
            'line',
            { 'stroke-width': 1.2, 'stroke-dasharray': '3,3', opacity: 0 },
            g,
          );
          const honest = svgEl('g', { opacity: 0 }, g);
          svgEl('circle', { r: 5, fill: 'none', 'stroke-width': 1.4 }, honest);
          svgEl('line', { x1: -8, x2: -5, y1: 0, y2: 0, 'stroke-width': 1.4 }, honest);
          svgEl('line', { x1: 5, x2: 8, y1: 0, y2: 0, 'stroke-width': 1.4 }, honest);
          svgEl('circle', { r: 1.4 }, honest);
          const head = svgEl('path', { d: 'M0,-5.5L5.5,0L0,5.5L-5.5,0Z', 'stroke-width': 1.5, stroke: 'var(--nova-tooltip-bg, #0f1626)' }, g);
          const edgeGlyph = svgEl(
            'text',
            { 'font-size': 13, 'font-weight': 700, 'text-anchor': 'end', opacity: 0 },
            g,
          );
          const bang = svgEl(
            'text',
            { fill: '#fb7185', 'font-size': 12, 'font-weight': 800, 'text-anchor': 'middle', opacity: 0 },
            g,
          );
          bang.textContent = '!';
          const doneDot = svgEl('circle', { r: 4.5, fill: '#34d399', opacity: 0 }, g);
          const item: RowItem = {
            g, label, diagonal, comet, dots: [], head, honest, honestLink, edgeGlyph, bang, doneDot,
            pts: [], cum: [], total: 0, task, removeFn: null,
          };
          this.layoutRow(item);
          return item;
        },
        update: (item, task) => {
          item.task = task;
          this.layoutRow(item);
        },
        exit: (item, remove) => {
          item.g.remove();
          remove();
        },
      },
    );
  }

  /** Static (τ-independent) geometry for one row. */
  private layoutRow(item: RowItem): void {
    const t = item.task;
    const yTop = this.yBand(t.id);
    const h = this.yBand.bandwidth();
    const yOf = (at: number): number => yTop + clamp((at - this.t0) / Math.max(this.tEnd - this.t0, 1e-9), 0, 1) * h;

    const history = [...t.history].sort((a, b) => a.at - b.at);
    item.pts = history.map((p) => ({ at: p.at, x: this.xScale(p.finish), y: yOf(p.at) }));
    if (t.actual !== undefined) item.pts.push({ at: t.actual, x: this.xScale(t.actual), y: yOf(t.actual) });
    item.cum = [0];
    for (let i = 1; i < item.pts.length; i++) {
      const a = item.pts[i - 1]!;
      const b = item.pts[i]!;
      item.cum.push(item.cum[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
    }
    item.total = item.cum[item.cum.length - 1] ?? 0;
    item.comet.setAttribute('points', item.pts.map((p) => `${p.x},${p.y}`).join(' '));
    item.comet.setAttribute('stroke-dasharray', `0 ${item.total + 1}`);

    item.label.setAttribute('x', String(this.plot.x + 4));
    item.label.setAttribute('y', String(yTop - 3));

    // Reality line: promise == report date, drawn through the band's time axis.
    item.diagonal.setAttribute('x1', String(this.xScale(this.t0)));
    item.diagonal.setAttribute('y1', String(yOf(this.t0)));
    item.diagonal.setAttribute('x2', String(this.xScale(this.tEnd)));
    item.diagonal.setAttribute('y2', String(yOf(this.tEnd)));

    // Snapshot dots (re-plan events), revealed as τ passes them.
    for (const d of item.dots) d.remove();
    item.dots = item.pts.slice(0, history.length).map((p) =>
      svgEl('circle', { cx: p.x, cy: p.y, r: 2, fill: 'var(--nova-fg-muted)', opacity: 0 }, item.g),
    );
    if (t.actual !== undefined) {
      const last = item.pts[item.pts.length - 1]!;
      item.doneDot.setAttribute('cx', String(last.x));
      item.doneDot.setAttribute('cy', String(last.y));
    }
  }

  // ---- τ frame --------------------------------------------------------------

  /** Everything the scrub position controls; runs on every τ frame. */
  private applyTau(): void {
    const tau = this.tau.get();
    const nowX = this.xScale(clamp(tau, this.t0, this.tEnd));
    this.nowLine.setAttribute('x1', String(nowX));
    this.nowLine.setAttribute('x2', String(nowX));
    this.nowLabel.setAttribute('x', String(nowX));
    this.nowLabel.textContent = this.fmtDay(tau);

    let worst: { stat: DriftStat; name: string } | null = null;
    for (const item of this.items.values()) {
      const stat = this.paintRow(item, tau);
      if (stat.done) continue;
      const worse =
        !worst ||
        (stat.runaway && !worst.stat.runaway) ||
        (stat.runaway === worst.stat.runaway && stat.honest > worst.stat.honest);
      if (worse) worst = { stat, name: item.task.name ?? item.task.id };
    }
    if (worst) {
      const s = worst.stat;
      this.headline.textContent = s.runaway
        ? `${worst.name} is running away — at this drift it never lands`
        : `honest finish ${this.fmtDay(s.honest)} (${s.honest - s.promised >= 0.5 ? '+' : ''}${Math.round(s.honest - s.promised)}d vs promised)`;
      const c = velocityColor(s);
      this.headline.setAttribute('fill', vecToRgba(Float64Array.of(c.r, c.g, c.b, 1)));
    } else {
      this.headline.textContent = 'all tasks landed';
      this.headline.setAttribute('fill', 'var(--nova-fg-muted)');
    }
    if (this.hoveredId) this.showTooltip(this.hoveredId);
  }

  /** Per-row τ frame: comet reveal, head, honest forecast, states. Returns the stat. */
  private paintRow(item: RowItem, tau: number): DriftStat {
    const t = item.task;
    const stat = driftStat(t, tau);
    const pts = item.pts;
    const n = pts.length;

    // Arc-length of the comet revealed at τ, and the head riding its tip.
    let L = 0;
    let hx = pts[0]?.x ?? 0;
    let hy = pts[0]?.y ?? 0;
    if (n > 0) {
      if (tau >= pts[n - 1]!.at) {
        L = item.total;
        hx = pts[n - 1]!.x;
        hy = pts[n - 1]!.y;
      } else {
        for (let i = 1; i < n; i++) {
          const a = pts[i - 1]!;
          const b = pts[i]!;
          if (tau < a.at) break;
          if (tau <= b.at) {
            const f = (tau - a.at) / Math.max(b.at - a.at, 1e-9);
            L = item.cum[i - 1]! + (item.cum[i]! - item.cum[i - 1]!) * f;
            hx = a.x + (b.x - a.x) * f;
            hy = a.y + (b.y - a.y) * f;
            break;
          }
          L = item.cum[i]!;
          hx = b.x;
          hy = b.y;
        }
      }
    }
    item.comet.setAttribute('stroke-dasharray', `${L} ${item.total - L + 1}`);

    const c = velocityColor(stat);
    const fill = vecToRgba(Float64Array.of(c.r, c.g, c.b, 1));
    item.comet.setAttribute('stroke', fill);
    item.comet.setAttribute('opacity', '0.75');
    item.head.setAttribute('transform', `translate(${hx}, ${hy})`);
    item.head.setAttribute('fill', fill);

    // Re-plan dots fade in as τ passes each report.
    for (let i = 0; i < item.dots.length; i++) {
      item.dots[i]!.setAttribute('opacity', String(0.8 * clamp((tau - pts[i]!.at) / 1.5, 0, 1)));
    }

    // Honest forecast ⌖ — visible once the trend has ≥ 2 points and isn't done.
    const rightEdge = this.plot.x + this.plot.width - 6;
    const showHonest = stat.n >= 2 && !stat.done;
    if (showHonest && !stat.runaway) {
      const clamped = Math.min(this.xScale(stat.honest), rightEdge);
      item.honest.setAttribute('transform', `translate(${clamped}, ${hy})`);
      item.honest.setAttribute('opacity', '0.95');
      for (const child of item.honest.children) {
        (child as SVGElement).setAttribute('stroke', fill);
        (child as SVGElement).setAttribute('fill', child.tagName === 'circle' && child === item.honest.firstChild ? 'none' : fill);
      }
      // The dashed trend line runs from the head to the forecast in either
      // direction (a recovering task forecasts earlier than its promise).
      let lx1 = Math.min(hx, clamped) + 8;
      let lx2 = Math.max(hx, clamped) - 8;
      if (lx2 < lx1) lx2 = lx1;
      item.honestLink.setAttribute('x1', String(lx1));
      item.honestLink.setAttribute('y1', String(hy));
      item.honestLink.setAttribute('x2', String(lx2));
      item.honestLink.setAttribute('y2', String(hy));
      item.honestLink.setAttribute('stroke', fill);
      item.honestLink.setAttribute('opacity', '0.55');
      const beyond = this.xScale(stat.honest) > rightEdge;
      item.edgeGlyph.textContent = '→';
      item.edgeGlyph.setAttribute('opacity', beyond ? '0.9' : '0');
    } else {
      item.honest.setAttribute('opacity', '0');
      item.honestLink.setAttribute('opacity', '0');
      item.edgeGlyph.setAttribute('opacity', stat.runaway ? '0.95' : '0');
      item.edgeGlyph.textContent = '∞';
    }
    item.edgeGlyph.setAttribute('x', String(rightEdge + 4));
    item.edgeGlyph.setAttribute('y', String(hy + 4.5));
    item.edgeGlyph.setAttribute('fill', fill);

    // Broken promise: τ passed the promised date and the task isn't done.
    const broken = !stat.done && tau > planAt(t.history, tau) + 0.5;
    item.bang.setAttribute('x', String(hx));
    item.bang.setAttribute('y', String(hy - 9));
    item.bang.setAttribute('opacity', broken ? String(clamp((tau - planAt(t.history, tau)) / 2, 0, 1)) : '0');

    // Done: a green landing dot pops as τ crosses the actual finish.
    if (t.actual !== undefined) {
      const p = clamp((tau - t.actual) / 3, 0, 1);
      const pop = p * (1 + 0.5 * Math.sin(Math.PI * p));
      item.doneDot.setAttribute('opacity', String(p));
      item.doneDot.setAttribute('r', String(4.5 * pop));
    }
    return stat;
  }

  // ---- interaction ----------------------------------------------------------

  private bindPointer(): void {
    const toLocal = (e: PointerEvent): { x: number; y: number } => {
      const rect = this.svg.getBoundingClientRect();
      const vb = this.svg.viewBox.baseVal;
      const s = rect.width > 0 && vb.width > 0 ? vb.width / rect.width : 1;
      return { x: (e.clientX - rect.left) * s, y: (e.clientY - rect.top) * s };
    };
    // Horizontal drags scrub; vertical drags still scroll the page on touch.
    this.svg.style.touchAction = 'pan-y';
    this.svg.style.cursor = 'ew-resize';
    this.svg.style.userSelect = 'none';
    this.svg.style.webkitUserSelect = 'none';

    const down = (e: PointerEvent): void => {
      e.preventDefault(); // a scrub must not start a text selection
      this.scrubbing = true;
      try { this.svg.setPointerCapture(e.pointerId); } catch { /* jsdom */ }
      this.setAsOf(this.xScale.invert(toLocal(e).x));
    };
    const move = (e: PointerEvent): void => {
      const p = toLocal(e);
      if (this.scrubbing) {
        this.setAsOf(this.xScale.invert(p.x));
        return;
      }
      const idx = this.yBand.indexAt(p.y);
      const task = this.options.tasks[idx];
      const next = task && p.y >= this.plot.y ? task.id : null;
      if (next !== this.hoveredId) {
        this.hoveredId = next;
        for (const [id, item] of this.items) {
          item.comet.setAttribute('stroke-width', id === next ? '3' : '2');
        }
        if (!next) this.tooltip?.hide(this.immediate());
      }
      if (next) this.showTooltip(next);
    };
    const up = (e: PointerEvent): void => {
      this.scrubbing = false;
      try { this.svg.releasePointerCapture(e.pointerId); } catch { /* jsdom */ }
    };
    const leave = (e: PointerEvent): void => {
      if (e.pointerType !== 'touch') {
        this.hoveredId = null;
        this.tooltip?.hide(this.immediate());
      }
    };
    this.svg.addEventListener('pointerdown', down);
    this.svg.addEventListener('pointermove', move);
    this.svg.addEventListener('pointerup', up);
    this.svg.addEventListener('pointercancel', up);
    this.svg.addEventListener('pointerleave', leave);
    this.detach.push(
      () => this.svg.removeEventListener('pointerdown', down),
      () => this.svg.removeEventListener('pointermove', move),
      () => this.svg.removeEventListener('pointerup', up),
      () => this.svg.removeEventListener('pointercancel', up),
      () => this.svg.removeEventListener('pointerleave', leave),
    );
  }

  private showTooltip(id: string): void {
    const item = this.items.get(id);
    if (!item || !this.tooltip) return;
    const tau = this.tau.get();
    const stat = driftStat(item.task, tau);
    const c = velocityColor(stat);
    const color = vecToRgba(Float64Array.of(c.r, c.g, c.b, 1));
    const state = stat.done
      ? 'landed'
      : stat.runaway
        ? 'runaway — never lands at this drift'
        : tau > planAt(item.task.history, tau) + 0.5
          ? 'promise broken'
          : stat.velocity > 0.05
            ? 'slipping'
            : 'on plan';
    this.tooltip.show(
      {
        title: item.task.name ?? item.task.id,
        rows: [
          { color, label: 'Promise', value: `${this.fmtDay(stat.original)} → ${this.fmtDay(stat.promised)}` },
          { color, label: 'Slip', value: `${stat.slip >= 0 ? '+' : ''}${Math.round(stat.slip)}d over ${stat.n} re-plans` },
          { color, label: 'Drift', value: `${stat.velocity >= 0 ? '+' : ''}${(stat.velocity * 7).toFixed(1)} d/week` },
          { color, label: 'Honest', value: stat.done ? this.fmtDay(item.task.actual!) : stat.runaway ? '∞' : this.fmtDay(stat.honest) },
          { color, label: 'State', value: state },
        ],
      },
      { x: this.xScale(clamp(tau, this.t0, this.tEnd)), y: this.yBand.center(id) },
      this.immediate(),
    );
  }

  private fmtDay(d: number): string {
    if (!Number.isFinite(d)) return '∞';
    if (!this.options.startDate) return `D${Math.round(d)}`;
    const date = new Date(this.options.startDate.getTime() + d * DAY);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  protected override teardown(): void {
    for (const fn of this.detach) fn();
    this.detach = [];
    this.tau.destroy();
    this.tooltip?.destroy();
    this.xAxis.destroy();
    this.grid.destroy();
    this.items.clear();
  }
}
