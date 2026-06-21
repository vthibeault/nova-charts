import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GanttEditor, type EditorTask } from './gantt-editor.js';
import { forceReducedMotion } from '../motion/reduced-motion.js';

function host(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

const tasks = (): EditorTask[] => [
  { id: 'a', name: 'Alpha', start: 0, duration: 4 },
  { id: 'b', name: 'Beta', start: 0, duration: 5, dependsOn: ['a'] },
];

beforeEach(() => forceReducedMotion(true));
afterEach(() => {
  forceReducedMotion(null);
  document.body.textContent = '';
});

describe('GanttEditor', () => {
  it('renders a grid row and a bar per task, plus a dependency link', () => {
    const el = host();
    const ed = new GanttEditor(el, { tasks: tasks() });
    expect(el.querySelectorAll('.nge-grow').length).toBe(2);
    expect(el.querySelectorAll('.nge-bar').length).toBeGreaterThanOrEqual(2);
    // b depends on a → one arrowed connector.
    expect(el.querySelectorAll('.nge-timeline marker#nge-arrow').length).toBe(1);
    ed.destroy();
    expect(el.querySelector('.nge')).toBeNull();
  });

  it('auto-schedules a dependent after its predecessor', () => {
    const el = host();
    const ed = new GanttEditor(el, { tasks: tasks() });
    const startCells = [...el.querySelectorAll('.nge-grow')].map(
      (r) => r.querySelectorAll('.nge-cell.num')[0]!.textContent,
    );
    // a starts at 0, b auto-scheduled to a.finish = 4.
    expect(startCells[0]).toBe('0');
    expect(startCells[1]).toBe('4');
    ed.destroy();
  });

  it('addTask inserts a row and getTasks reflects it', () => {
    const el = host();
    const ed = new GanttEditor(el, { tasks: tasks() });
    ed.addTask();
    expect(el.querySelectorAll('.nge-grow').length).toBe(3);
    expect(ed.getTasks().length).toBe(3);
    ed.destroy();
  });

  it('indent makes the previous row a summary parent and rolls it up', () => {
    const el = host();
    // Three flat tasks; indent the 2nd under the 1st.
    const ed = new GanttEditor(el, {
      tasks: [
        { id: 'p', name: 'Phase', start: 0, duration: 3 },
        { id: 'c', name: 'Child', start: 2, duration: 4 },
      ],
    });
    // select Child, then indent
    (el.querySelectorAll('.nge-grow')[1] as HTMLElement).click();
    ed.indentSelected();
    // 'p' is now a summary row.
    expect(el.querySelector('.nge-grow.summary')).toBeTruthy();
    expect(ed.getTasks().find((t) => t.id === 'c')!.parent).toBe('p');
    ed.destroy();
  });

  it('collapsing a summary hides its children', () => {
    const el = host();
    const ed = new GanttEditor(el, {
      tasks: [
        { id: 'p', name: 'Phase', start: 0, duration: 0 },
        { id: 'c', name: 'Child', start: 0, duration: 4, parent: 'p' },
      ],
    });
    expect(el.querySelectorAll('.nge-grow').length).toBe(2);
    (el.querySelector('.nge-chev') as HTMLElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(el.querySelectorAll('.nge-grow').length).toBe(1); // child hidden
    ed.destroy();
  });
});
