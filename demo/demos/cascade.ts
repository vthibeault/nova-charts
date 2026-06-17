import { CascadeChart, type CascadeTask } from 'nova-charts';
import { makeShell } from './util.js';

export function mountCascadeDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Cascade (WBS)',
    'An SAP-style work breakdown. Collapsed WBS elements show a rolled-up summary bar — click one (or its ▸) to drill into its sub-WBS and activities. Click an activity bar to slip it and watch the delay ripple downstream, eat slack, and push the finish. Each bar trails its slack buffer.',
  );

  // WBS hierarchy: project → phases (level 1) → work packages / activities.
  const base: CascadeTask[] = [
    // Level 0
    { id: 'P', name: 'Platform Rollout' },
    // Level 1 phases
    { id: 'P1', name: 'Foundation', parent: 'P' },
    { id: 'P2', name: 'Build', parent: 'P' },
    { id: 'P3', name: 'Launch', parent: 'P' },
    // P1 activities
    { id: 'a-spec', name: 'Spec', parent: 'P1', duration: 4 },
    { id: 'a-design', name: 'Design', parent: 'P1', duration: 6, dependsOn: ['a-spec'] },
    // P2 sub-WBS
    { id: 'P2a', name: 'Backend', parent: 'P2' },
    { id: 'P2b', name: 'Frontend', parent: 'P2' },
    { id: 'b-api', name: 'API', parent: 'P2a', duration: 10, dependsOn: ['a-design'] },
    { id: 'b-data', name: 'Data model', parent: 'P2a', duration: 6, dependsOn: ['a-design'] },
    { id: 'f-ui', name: 'UI', parent: 'P2b', duration: 7, dependsOn: ['a-design'] },
    { id: 'f-content', name: 'Content', parent: 'P2b', duration: 5, dependsOn: ['a-design'] },
    // P3 activities
    { id: 'l-int', name: 'Integration', parent: 'P3', duration: 4, dependsOn: ['P2a', 'P2b'] },
    { id: 'l-qa', name: 'QA', parent: 'P3', duration: 5, dependsOn: ['l-int'] },
    { id: 'l-go', name: 'Go-live', parent: 'P3', duration: 2, dependsOn: ['l-qa'] },
  ];

  const chart = new CascadeChart(chartHost, {
    tasks: base,
    unit: 'd',
    slipStep: 3,
    deadline: 36,
    expanded: ['P'], // start with the top level opened, phases rolled up
    margin: { left: 150, top: 28 },
  });

  controls.button('Expand all', () => chart.expandAll(), true);
  controls.button('Collapse all', () => chart.collapseAll());
  controls.button('Slip “API” +3d', () => chart.nudge('b-api', 3));
  controls.button('Slip “UI” +3d', () => chart.nudge('f-ui', 3));
  controls.button('Reset slips', () => chart.reset());

  return () => chart.destroy();
}
