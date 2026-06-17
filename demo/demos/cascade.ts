import { CascadeChart, type CascadeTask } from 'nova-charts';
import { makeShell } from './util.js';

export function mountCascadeDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Cascade',
    'A live critical-path what-if. Each bar trails its slack buffer (how long it can slip before it hurts). Click any task — or use the buttons — to slip it, and watch the delay ripple downstream, eat slack, turn bars red, and push the finish line.',
  );

  const base: CascadeTask[] = [
    { id: 'spec', name: 'Spec', duration: 4 },
    { id: 'design', name: 'Design', duration: 6, dependsOn: ['spec'] },
    { id: 'api', name: 'API', duration: 10, dependsOn: ['design'] },
    { id: 'ui', name: 'UI', duration: 7, dependsOn: ['design'] },
    { id: 'content', name: 'Content', duration: 5, dependsOn: ['spec'] },
    { id: 'integrate', name: 'Integration', duration: 4, dependsOn: ['api', 'ui'] },
    { id: 'qa', name: 'QA', duration: 5, dependsOn: ['integrate', 'content'] },
    { id: 'launch', name: 'Launch', duration: 2, dependsOn: ['qa'] },
  ];

  const chart = new CascadeChart(chartHost, {
    tasks: base,
    unit: 'd',
    slipStep: 3,
    deadline: 34,
    margin: { left: 96, top: 28 },
  });

  controls.button('Slip “Design” +3d', () => chart.nudge('design', 3), true);
  controls.button('Slip “UI” +3d (has slack)', () => chart.nudge('ui', 3));
  controls.button('Slip “API” +4d', () => chart.nudge('api', 4));
  controls.button('Reset', () => chart.reset());

  return () => chart.destroy();
}
