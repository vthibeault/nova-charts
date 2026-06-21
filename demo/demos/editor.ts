import { GanttEditor, type EditorTask } from 'nova-charts';

export function mountEditorDemo(host: HTMLElement): () => void {
  const header = document.createElement('div');
  header.className = 'demo-header';
  header.innerHTML =
    '<h2>Gantt Editor</h2><p>An MS-Project-style editor. Double-click a name or duration to edit; ' +
    'drag a bar to reschedule, drag its right edge to resize, drag the dot at a bar’s end onto another bar to ' +
    'link them (dependents auto-reschedule). Use the toolbar to add/indent/outdent tasks, set a baseline, and zoom. ' +
    'The critical path is red; the baseline shows as a grey strip under each bar.</p>';
  host.appendChild(header);

  const wrap = document.createElement('div');
  wrap.className = 'chart-card';
  wrap.style.padding = '0';
  const mount = document.createElement('div');
  mount.style.height = '460px';
  wrap.appendChild(mount);
  host.appendChild(wrap);

  const tasks: EditorTask[] = [
    { id: 'plan', name: 'Planning', start: 0, duration: 0 },
    { id: 'spec', name: 'Spec', start: 0, duration: 4, parent: 'plan' },
    { id: 'design', name: 'Design', start: 0, duration: 6, parent: 'plan', dependsOn: ['spec'] },
    { id: 'build', name: 'Build', start: 0, duration: 0 },
    { id: 'api', name: 'API', start: 0, duration: 10, parent: 'build', dependsOn: ['design'] },
    { id: 'ui', name: 'UI', start: 0, duration: 7, parent: 'build', dependsOn: ['design'], progress: 0.3 },
    { id: 'qa', name: 'QA', start: 0, duration: 5, dependsOn: ['api', 'ui'] },
    { id: 'launch', name: 'Launch', start: 0, duration: 2, dependsOn: ['qa'] },
  ];

  const editor = new GanttEditor(mount, {
    tasks,
    startDate: new Date(2026, 5, 1),
    dayWidth: 24,
  });

  return () => editor.destroy();
}
