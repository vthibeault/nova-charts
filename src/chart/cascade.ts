import { Chart, type UpdateReason } from '../core/chart.js';
import type { BaseChartOptions, ChartData } from '../core/types.js';
import { svgEl } from '../core/svg.js';
import { keyedJoin, type JoinItem } from '../core/join.js';
import { AnimatedValue, AnimatedVec } from '../motion/animated.js';
import { scaleLinear, type LinearScale } from '../scale/linear.js';
import { scaleBand, type BandScale } from '../scale/band.js';
import { Axis } from '../component/axis.js';
import { Grid } from '../component/grid.js';
import { Tooltip } from '../component/tooltip.js';
import { PointerTracker, type PointerPos } from '../interaction/pointer.js';
import { resolveColor } from '../theme/theme.js';
import { vecToRgba, type RGBA } from '../interpolate/color.js';
import { clamp } from '../interpolate/number.js';
import { criticalPath, type CpmTask, type CpmNode } from '../analysis/criticalpath.js';

export interface CascadeTask {
  id: string;
  name?: string;
  duration: number;
  dependsOn?: string[];
  color?: string;
}

export interface CascadeChartOptions extends Omit<BaseChartOptions, 'data'> {
  tasks: CascadeTask[];
  /** Unit label for durations (default 'd'). */
  unit?: string;
  /** Days a task slips per click / nudge (default 2). */
  slipStep?: number;
  /** Target finish; if the project overruns it the deadline line turns red. */
  deadline?: number;
  data?: ChartData;
}

const GREEN: RGBA = { r: 52, g: 211, b: 153, a: 1 }; // lots of slack
const AMBER: RGBA = { r: 251, g: 191, b: 36, a: 1 }; // slack running low
const RED: RGBA = { r: 251, g: 113, b: 133, a: 1 }; // critical / no slack

function mix(a: RGBA, b: RGBA, t: number): RGBA {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: 1 };
}

function healthColor(node: CpmNode): RGBA {
  if (node.critical) return RED;
  const dur = node.ef - node.es;
  const t = clamp(node.float / (0.5 * dur + 3), 0, 1);
  return mix(AMBER, GREEN, t);
}

interface BarItem extends JoinItem {
  g: SVGGElement;
  bar: SVGRectElement;
  slack: SVGRectElement;
  label: SVGTextElement;
  /** [esX, efX, lfX, cy, h] */
  geo: AnimatedVec;
  color: AnimatedVec;
  opacity: AnimatedValue;
  task: CascadeTask;
  node: CpmNode;
  colorResolved: string;
  removeFn: (() => void) | null;
}

/**
 * Cascade — an interactive critical-path timeline with live slack and delay
 * propagation. Each task bar trails a translucent *slack buffer* (how long it
 * can slip before it hurts the deadline). Nudge a task later and the delay
 * ripples downstream through the dependency chain — bars slide, buffers shrink,
 * colours run green→amber→red as slack is consumed, and the project finish
 * line moves. The ripple is staggered by dependency depth, so you literally
 * watch the delay travel.
 */
export class CascadeChart extends Chart<CascadeChartOptions & { data: ChartData }> {
  private gridLayer: SVGGElement;
  private connectorLayer: SVGGElement;
  private barLayer: SVGGElement;
  private axisLayer: SVGGElement;
  private xAxis: Axis;
  private yAxis: Axis;
  private grid: Grid;
  private tooltip: Tooltip | null = null;
  private pointerTracker: PointerTracker;
  private finishLine: SVGLineElement;
  private finishLabel: SVGTextElement;
  private baselineLine: SVGLineElement;
  private deadlineLine: SVGLineElement | null = null;
  private finishX = new AnimatedValue(0, { stiffness: 150, damping: 20 });
  private baselineX = new AnimatedValue(0, { stiffness: 150, damping: 20 });
  private items = new Map<string, BarItem>();
  private connectors: SVGPathElement[] = [];
  private connectorUnsubs: Array<() => void> = [];
  private slip = new Map<string, number>();
  private xScale!: LinearScale;
  private yBand!: BandScale;
  private cpm = criticalPath([]);
  private baselineFinish = 0;
  private hoveredId: string | null = null;
  private lastPointer: PointerPos | null = null;
  private entranceDone = false;

  constructor(el: HTMLElement, options: CascadeChartOptions) {
    super(el, { ...options, data: options.data ?? { series: [] } });
    this.gridLayer = svgEl('g', {}, this.svg);
    this.connectorLayer = svgEl('g', {}, this.svg);
    this.barLayer = svgEl('g', {}, this.svg);
    this.axisLayer = svgEl('g', {}, this.svg);
    const spring = this.springConfig();
    this.xAxis = new Axis(this.axisLayer, 'bottom', spring);
    this.yAxis = new Axis(this.axisLayer, 'left', spring);
    this.grid = new Grid(this.gridLayer, spring, 'vertical');
    this.baselineLine = svgEl(
      'line',
      { stroke: 'var(--nova-fg-muted)', 'stroke-width': 1, 'stroke-dasharray': '2,3', opacity: 0 },
      this.svg,
    );
    this.finishLine = svgEl(
      'line',
      { stroke: 'var(--nova-c2)', 'stroke-width': 2, 'stroke-dasharray': '5,4', opacity: 0 },
      this.svg,
    );
    this.finishLabel = svgEl(
      'text',
      { fill: 'var(--nova-c2)', 'font-size': 11, 'font-weight': 700, 'text-anchor': 'middle' },
      this.svg,
    );
    this.baselineX.onChange((v) => {
      this.baselineLine.setAttribute('x1', String(v));
      this.baselineLine.setAttribute('x2', String(v));
    });
    this.finishX.onChange((v) => {
      this.finishLine.setAttribute('x1', String(v));
      this.finishLine.setAttribute('x2', String(v));
      this.finishLabel.setAttribute('x', String(v));
    });
    if (options.tooltip !== false) this.tooltip = new Tooltip(this.overlay);
    this.pointerTracker = new PointerTracker(
      this.svg,
      (p) => {
        this.lastPointer = p;
        this.pointerMove(p);
      },
      (p) => this.pointerClick(p),
    );
    this.bootstrap();
  }

  /** Slip a task later by `days` (default slipStep) and ripple the cascade. */
  nudge(id: string, days?: number): void {
    const step = days ?? this.options.slipStep ?? 2;
    this.slip.set(id, (this.slip.get(id) ?? 0) + step);
    this.update('data');
    this.announcer.announce(`${id} slipped; cascade updated`);
  }

  /** Clear all injected slips. */
  reset(): void {
    this.slip.clear();
    this.update('data');
  }

  setTasks(tasks: CascadeTask[]): void {
    this.options.tasks = tasks;
    this.slip.clear();
    this.update('data');
  }

  get tasks(): CascadeTask[] {
    return this.options.tasks;
  }

  protected override chartType(): string {
    return 'Cascade';
  }

  protected override ariaLabel(): string {
    return this.options.ariaLabel ?? `Critical-path cascade, ${this.options.tasks.length} tasks`;
  }

  private unit(): string {
    return this.options.unit ?? 'd';
  }

  protected override update(reason: UpdateReason): void {
    const immediate = this.immediate() || reason === 'resize';
    const spring = this.springConfig();
    const colorSpring = { stiffness: 110, damping: 24 };
    const tasks = this.options.tasks;
    const rippling = reason === 'data';

    const withSlip: CpmTask[] = tasks.map((t) => ({
      id: t.id,
      duration: t.duration,
      ...(t.dependsOn ? { dependsOn: t.dependsOn } : {}),
      slip: this.slip.get(t.id) ?? 0,
    }));
    if (reason !== 'resize') {
      this.cpm = criticalPath(withSlip);
      this.baselineFinish = criticalPath(
        tasks.map((t) => ({
          id: t.id,
          duration: t.duration,
          ...(t.dependsOn ? { dependsOn: t.dependsOn } : {}),
        })),
      ).projectFinish;
    }
    const cpm = this.cpm;
    const horizon = Math.max(cpm.projectFinish, this.baselineFinish, this.options.deadline ?? 0, 1);

    this.xScale = scaleLinear({
      domain: [0, horizon],
      range: [this.plot.x, this.plot.x + this.plot.width],
      nice: true,
    });
    this.yBand = scaleBand({
      domain: tasks.map((t) => t.id),
      range: [this.plot.y, this.plot.y + this.plot.height],
      paddingInner: 0.4,
      paddingOuter: 0.2,
    });

    const chromeImmediate = this.immediate() || reason === 'resize';
    const xticks = this.xScale.ticks(Math.max(3, Math.floor(this.plot.width / 80)));
    this.xAxis.update(
      xticks.map((v) => ({ key: String(v), label: `${Math.round(v)}${this.unit()}`, pos: this.xScale(v) })),
      this.plot,
      chromeImmediate,
    );
    this.grid.update(
      xticks.map((v) => ({ key: String(v), pos: this.xScale(v) })),
      this.plot,
      chromeImmediate,
    );
    this.yAxis.update(
      tasks.map((t) => ({ key: t.id, label: t.name ?? t.id, pos: this.yBand.center(t.id) })),
      this.plot,
      chromeImmediate,
    );

    // Finish lines: live project finish, faint baseline (no slips), deadline.
    const top = this.plot.y - 4;
    const bot = this.plot.y + this.plot.height + 4;
    for (const ln of [this.finishLine, this.baselineLine]) {
      ln.setAttribute('y1', String(top));
      ln.setAttribute('y2', String(bot));
    }
    this.finishLine.setAttribute('opacity', '0.9');
    this.finishLabel.setAttribute('y', String(top - 2));
    const overrun = cpm.projectFinish - this.baselineFinish;
    this.finishLabel.textContent =
      `Finish ${Math.round(cpm.projectFinish)}${this.unit()}` +
      (overrun > 0.001 ? ` (+${Math.round(overrun)})` : '');
    this.finishX.set(this.xScale(cpm.projectFinish), { immediate });
    this.baselineLine.setAttribute('opacity', overrun > 0.001 ? '0.7' : '0');
    this.baselineX.set(this.xScale(this.baselineFinish), { immediate });
    this.renderDeadline(top, bot, immediate);

    const rowH = this.yBand.bandwidth();

    keyedJoin(
      this.items,
      tasks.map((t, i) => [t.id, { t, i, node: cpm.nodes.get(t.id)! }] as const),
      {
        enter: (_key, d, i) => {
          const node = d.node;
          const cy = this.yBand.center(d.t.id);
          const g = svgEl('g', {}, this.barLayer);
          const slack = svgEl('rect', { rx: 3, 'fill-opacity': 0.22 }, g);
          const bar = svgEl('rect', { rx: 4 }, g);
          const label = svgEl('text', { fill: '#fff', 'font-size': 10, 'font-weight': 600 }, g);
          const hc = healthColor(node);
          const esX = this.xScale(node.es);
          const efX = this.xScale(node.ef);
          const lfX = this.xScale(node.lf);
          const grow = !this.immediate();
          const geo = new AnimatedVec(grow ? [esX, esX, esX, cy, rowH] : [esX, efX, lfX, cy, rowH], spring);
          const color = new AnimatedVec([hc.r, hc.g, hc.b, hc.a], colorSpring);
          const opacity = new AnimatedValue(1, spring);
          const item: BarItem = {
            g,
            bar,
            slack,
            label,
            geo,
            color,
            opacity,
            task: d.t,
            node,
            colorResolved: resolveColor(this.el, vecToRgba([hc.r, hc.g, hc.b, hc.a])),
            removeFn: null,
          };
          const render = (): void => this.renderItem(item);
          geo.onChange(render);
          color.onChange(render);
          geo.onRest(() => {
            if (item.exiting) {
              g.remove();
              this.disposeItem(item);
              item.removeFn?.();
            }
          });
          opacity.onChange((v) => g.setAttribute('opacity', String(Math.max(v, 0))));
          render();
          if (grow) {
            const delay = this.entranceDone ? 0 : i * 70;
            geo.set([esX, efX, lfX, cy, rowH], {
              delays: Float64Array.of(delay, delay, delay, delay, delay),
            });
          }
          return item;
        },
        update: (item, d) => {
          item.task = d.t;
          item.node = d.node;
          const hc = healthColor(d.node);
          item.colorResolved = resolveColor(this.el, vecToRgba([hc.r, hc.g, hc.b, hc.a]));
          const esX = this.xScale(d.node.es);
          const efX = this.xScale(d.node.ef);
          const lfX = this.xScale(d.node.lf);
          // Ripple: stagger the retarget by dependency depth so the delay
          // visibly travels downstream from the slipped task.
          const delay = rippling && !immediate ? d.node.depth * 80 : 0;
          item.geo.set([esX, efX, lfX, this.yBand.center(d.t.id), rowH], {
            immediate,
            delays: Float64Array.of(delay, delay, delay, delay, delay),
          });
          item.color.set([hc.r, hc.g, hc.b, hc.a], { immediate, ...(delay ? { delay } : {}) });
          item.opacity.set(this.hoveredId === null || this.hoveredId === d.t.id ? 1 : 0.5, {
            immediate,
          });
        },
        exit: (item, remove) => {
          item.removeFn = remove;
          if (immediate) {
            item.g.remove();
            this.disposeItem(item);
            remove();
          } else {
            const t = item.geo.getTargets();
            item.geo.set([t[0]!, t[0]!, t[0]!, t[3]!, t[4]!]);
            item.opacity.set(0);
          }
        },
      },
    );

    this.rebuildConnectors();
    this.entranceDone = true;
    if (this.lastPointer) this.pointerMove(this.lastPointer);
  }

  private renderDeadline(top: number, bot: number, immediate: boolean): void {
    if (this.options.deadline === undefined) {
      this.deadlineLine?.remove();
      this.deadlineLine = null;
      return;
    }
    if (!this.deadlineLine) {
      this.deadlineLine = svgEl('line', { 'stroke-width': 2 }, this.svg);
    }
    const over = this.cpm.projectFinish > this.options.deadline + 0.001;
    const x = this.xScale(this.options.deadline);
    this.deadlineLine.setAttribute('x1', String(x));
    this.deadlineLine.setAttribute('x2', String(x));
    this.deadlineLine.setAttribute('y1', String(top));
    this.deadlineLine.setAttribute('y2', String(bot));
    this.deadlineLine.setAttribute('stroke', over ? 'var(--nova-c7)' : 'var(--nova-c4)');
    this.deadlineLine.setAttribute('opacity', '0.8');
    void immediate;
  }

  private renderItem(item: BarItem): void {
    const v = item.geo.values;
    const esX = v[0]!;
    const efX = v[1]!;
    const lfX = v[2]!;
    const cy = v[3]!;
    const h = Math.max(v[4]!, 0);
    const y = cy - h / 2;
    const fill = vecToRgba(item.color.values);
    item.bar.setAttribute('x', String(esX));
    item.bar.setAttribute('y', String(y));
    item.bar.setAttribute('width', String(Math.max(efX - esX, 0)));
    item.bar.setAttribute('height', String(h));
    item.bar.setAttribute('fill', fill);
    const slackW = Math.max(lfX - efX, 0);
    item.slack.setAttribute('x', String(efX));
    item.slack.setAttribute('y', String(y + h * 0.2));
    item.slack.setAttribute('width', String(slackW));
    item.slack.setAttribute('height', String(h * 0.6));
    item.slack.setAttribute('fill', fill);
    item.slack.setAttribute('opacity', slackW > 1 ? '1' : '0');
    item.label.setAttribute('x', String(esX + 6));
    item.label.setAttribute('y', String(y - 4));
    item.label.textContent = item.task.name ?? item.task.id;
  }

  private rebuildConnectors(): void {
    for (const u of this.connectorUnsubs) u();
    this.connectorUnsubs = [];
    for (const p of this.connectors) p.remove();
    this.connectors = [];
    for (const task of this.options.tasks) {
      const target = this.items.get(task.id);
      if (!target || !task.dependsOn) continue;
      for (const depId of task.dependsOn) {
        const source = this.items.get(depId);
        if (!source) continue;
        const path = svgEl(
          'path',
          { fill: 'none', stroke: 'var(--nova-fg-muted)', 'stroke-width': 1.2, 'stroke-dasharray': '3,3', opacity: 0.55 },
          this.connectorLayer,
        );
        this.connectors.push(path);
        const redraw = (): void => {
          const s = source.geo.values;
          const t = target.geo.values;
          const sx = s[1]!; // predecessor finish (EF)
          const sy = s[3]!;
          const tx = t[0]!; // successor start (ES)
          const ty = t[3]!;
          const elbow = Math.max(sx + 8, tx - 8);
          path.setAttribute('d', `M${sx},${sy}L${elbow},${sy}L${elbow},${ty}L${tx},${ty}`);
        };
        redraw();
        this.connectorUnsubs.push(source.geo.onChange(redraw), target.geo.onChange(redraw));
      }
    }
  }

  private itemAt(p: PointerPos): BarItem | null {
    const idx = this.yBand.indexAt(p.y);
    const task = this.options.tasks[idx];
    if (!task) return null;
    const item = this.items.get(task.id);
    if (!item || item.exiting) return null;
    const v = item.geo.getTargets();
    if (Math.abs(p.y - v[3]!) > v[4]! / 2 + 4) return null;
    if (p.x < v[0]! - 6 || p.x > v[2]! + 6) return null;
    return item;
  }

  private pointerMove(p: PointerPos | null): void {
    const item = p ? this.itemAt(p) : null;
    const immediate = this.immediate();
    const nextId = item ? item.task.id : null;
    if (nextId !== this.hoveredId) {
      this.hoveredId = nextId;
      for (const [id, it] of this.items) {
        if (!it.exiting) it.opacity.set(nextId === null || id === nextId ? 1 : 0.5, { immediate });
      }
    }
    if (item && p) {
      const n = item.node;
      const c = item.colorResolved;
      const u = this.unit();
      const slipped = this.slip.get(item.task.id) ?? 0;
      const rows = [
        { color: c, label: 'Window', value: `${Math.round(n.es)}–${Math.round(n.ef)}${u}` },
        {
          color: c,
          label: 'Slack',
          value: n.critical ? 'none (critical)' : `${Math.round(n.float)}${u}`,
        },
        {
          color: c,
          label: n.critical ? 'Status' : 'Can slip',
          value: n.critical ? 'on critical path' : `${Math.round(n.float)}${u} before it bites`,
        },
      ];
      if (slipped > 0) rows.push({ color: c, label: 'Slipped', value: `+${Math.round(slipped)}${u}` });
      this.tooltip?.show(
        { title: `${item.task.name ?? item.task.id}  ·  click to slip +${this.options.slipStep ?? 2}${u}`, rows },
        { x: p.x, y: item.geo.getTargets()[3]! },
        immediate,
      );
    } else {
      this.tooltip?.hide(immediate);
    }
  }

  private pointerClick(p: PointerPos): void {
    const item = this.itemAt(p);
    if (item) {
      this.emit('point:click', {
        seriesId: item.task.id,
        index: this.options.tasks.indexOf(item.task),
        value: item.node.float,
        label: item.task.name ?? item.task.id,
        clientX: p.clientX,
        clientY: p.clientY,
      });
      this.nudge(item.task.id);
    }
  }

  private disposeItem(item: BarItem): void {
    item.geo.destroy();
    item.color.destroy();
    item.opacity.destroy();
  }

  protected override teardown(): void {
    this.pointerTracker.destroy();
    this.xAxis.destroy();
    this.yAxis.destroy();
    this.grid.destroy();
    this.tooltip?.destroy();
    this.finishX.destroy();
    this.baselineX.destroy();
    for (const u of this.connectorUnsubs) u();
    for (const p of this.connectors) p.remove();
    for (const item of this.items.values()) this.disposeItem(item);
    this.items.clear();
  }
}
