import { mountLineDemo } from './demos/line.js';
import { mountAreaDemo } from './demos/area.js';
import { mountBarDemo } from './demos/bar.js';
import { mountDonutDemo } from './demos/donut.js';
import { mountScatterDemo } from './demos/scatter.js';
import { mountRadarDemo } from './demos/radar.js';
import { mountGaugeDemo } from './demos/gauge.js';
import { mountHeatmapDemo } from './demos/heatmap.js';
import { mountPolarDemo } from './demos/polar.js';
import { mountFunnelDemo } from './demos/funnel.js';
import { mountWaterfallDemo } from './demos/waterfall.js';
import { mountCandlestickDemo } from './demos/candlestick.js';
import { mountGanttDemo } from './demos/gantt.js';
import { mountBudgetFlowDemo } from './demos/budgetflow.js';
import { mountTreemapDemo } from './demos/treemap.js';
import { mountBoxPlotDemo } from './demos/boxplot.js';
import { mountSankeyDemo } from './demos/sankey.js';
import { mountStreamDemo } from './demos/stream.js';
import { mountForecastDemo } from './demos/forecast.js';
import { mountCascadeDemo } from './demos/cascade.js';
import { mountStressDemo } from './demos/stress.js';

type DemoMount = (host: HTMLElement) => () => void;

const demos: { id: string; name: string; mount: DemoMount }[] = [
  { id: 'line', name: 'Line', mount: mountLineDemo },
  { id: 'area', name: 'Area', mount: mountAreaDemo },
  { id: 'bar', name: 'Bar', mount: mountBarDemo },
  { id: 'donut', name: 'Donut / Pie', mount: mountDonutDemo },
  { id: 'scatter', name: 'Scatter / Bubble', mount: mountScatterDemo },
  { id: 'radar', name: 'Radar', mount: mountRadarDemo },
  { id: 'gauge', name: 'Gauge', mount: mountGaugeDemo },
  { id: 'heatmap', name: 'Heatmap', mount: mountHeatmapDemo },
  { id: 'polar', name: 'Polar area', mount: mountPolarDemo },
  { id: 'funnel', name: 'Funnel', mount: mountFunnelDemo },
  { id: 'waterfall', name: 'Waterfall', mount: mountWaterfallDemo },
  { id: 'candlestick', name: 'Candlestick', mount: mountCandlestickDemo },
  { id: 'gantt', name: 'Gantt', mount: mountGanttDemo },
  { id: 'budgetflow', name: '★ Budget Flow', mount: mountBudgetFlowDemo },
  { id: 'treemap', name: 'Treemap', mount: mountTreemapDemo },
  { id: 'boxplot', name: 'Box plot', mount: mountBoxPlotDemo },
  { id: 'sankey', name: 'Sankey', mount: mountSankeyDemo },
  { id: 'stream', name: '★ Stream', mount: mountStreamDemo },
  { id: 'forecast', name: '★ Forecast', mount: mountForecastDemo },
  { id: 'cascade', name: '★ Cascade', mount: mountCascadeDemo },
  { id: 'stress', name: 'Stress test', mount: mountStressDemo },
];

const nav = document.getElementById('nav')!;
const main = document.getElementById('main')!;
let cleanup: (() => void) | null = null;

function route(): void {
  const id = location.hash.slice(1) || demos[0]!.id;
  const demo = demos.find((d) => d.id === id) ?? demos[0]!;
  cleanup?.();
  main.textContent = '';
  cleanup = demo.mount(main as HTMLElement);
  for (const a of nav.querySelectorAll('a')) {
    a.classList.toggle('active', a.getAttribute('href') === `#${demo.id}`);
  }
}

for (const d of demos) {
  const a = document.createElement('a');
  a.href = `#${d.id}`;
  a.textContent = d.name;
  nav.appendChild(a);
}

window.addEventListener('hashchange', route);
route();
