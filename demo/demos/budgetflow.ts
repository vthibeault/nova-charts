import { BudgetFlowChart, type BudgetFlowTask } from 'nova-charts';
import { makeShell, liveMode } from './util.js';

export function mountBudgetFlowDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Budget Flow',
    'One timeline for schedule + budget + health + forecast. Thickness = budget, fill = spend, the gap to the “today” line + color = health, and the translucent tail forecasts an over-run. Log spend and watch it flow.',
  );

  const day = 86_400_000;
  const t0 = new Date(2026, 5, 1).getTime();
  const base: BudgetFlowTask[] = [
    { id: 'discovery', name: 'Discovery', start: t0, end: t0 + 8 * day, budget: 40_000, spent: 38_000 },
    { id: 'design', name: 'Design', start: t0 + 6 * day, end: t0 + 16 * day, budget: 60_000, spent: 41_000, dependsOn: ['discovery'] },
    { id: 'build', name: 'Build', start: t0 + 14 * day, end: t0 + 34 * day, budget: 180_000, spent: 96_000, dependsOn: ['design'] },
    { id: 'data', name: 'Data migration', start: t0 + 20 * day, end: t0 + 32 * day, budget: 70_000, spent: 52_000, dependsOn: ['design'] },
    { id: 'qa', name: 'QA & hardening', start: t0 + 32 * day, end: t0 + 42 * day, budget: 50_000, spent: 8_000, dependsOn: ['build', 'data'] },
    { id: 'launch', name: 'Launch', start: t0 + 42 * day, end: t0 + 46 * day, budget: 25_000, spent: 0, dependsOn: ['qa'] },
  ];
  const clone = (): BudgetFlowTask[] => base.map((t) => ({ ...t }));
  let state = clone();
  let now = t0 + 24 * day;

  const fmtMoney = (n: number): string =>
    n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`;

  const chart = new BudgetFlowChart(chartHost, {
    tasks: state,
    now,
    currency: fmtMoney,
    margin: { left: 110, top: 24 },
  });

  controls.button(
    'Log spend',
    () => {
      state = state.map((t) => {
        const start = t.start as number;
        const end = t.end as number;
        const active = now >= start && now <= end + 4 * day && t.spent < t.budget * 1.4;
        if (!active) return t;
        const burn = t.budget * (0.04 + Math.random() * 0.1);
        return { ...t, spent: Math.round(t.spent + burn) };
      });
      chart.setTasks(state);
    },
    true,
  );
  controls.button('Advance time', () => {
    now += 3 * day;
    chart.setNow(now);
  });
  controls.button('Replan (shift)', () => {
    state = state.map((t) => {
      const shift = Math.round((Math.random() - 0.4) * 3) * day;
      return { ...t, start: (t.start as number) + shift, end: (t.end as number) + shift };
    });
    chart.setTasks(state);
  });
  controls.button('Reset', () => {
    state = clone();
    now = t0 + 24 * day;
    chart.setNow(now);
    chart.setTasks(state);
  });

  // Live mode: time marches forward and spend trickles in.
  const live = liveMode(() => {
    now += day;
    state = state.map((t) => {
      const start = t.start as number;
      const end = t.end as number;
      const active = now >= start && now <= end + 2 * day && t.spent < t.budget * 1.3;
      return active ? { ...t, spent: Math.round(t.spent + t.budget * (0.02 + Math.random() * 0.05)) } : t;
    });
    chart.setNow(now);
    chart.setTasks(state);
  }, 1400);
  controls.checkbox('Live mode', (on) => live.set(on));

  return () => {
    live.stop();
    chart.destroy();
  };
}
