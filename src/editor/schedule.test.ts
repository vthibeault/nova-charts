import { describe, expect, it } from 'vitest';
import { schedule } from './schedule.js';

describe('schedule (auto-scheduling)', () => {
  it('respects manual start for tasks without predecessors', () => {
    const r = schedule([{ id: 'a', duration: 5, start: 3 }]);
    expect(r.nodes.get('a')!.start).toBe(3);
    expect(r.nodes.get('a')!.end).toBe(8);
    expect(r.finish).toBe(8);
  });

  it('places a dependent at the predecessor finish (finish→start)', () => {
    const r = schedule([
      { id: 'a', duration: 5, start: 0 },
      { id: 'b', duration: 3, dependsOn: ['a'] },
    ]);
    expect(r.nodes.get('b')!.start).toBe(5);
    expect(r.nodes.get('b')!.end).toBe(8);
  });

  it('a dependent waits for the latest of several predecessors', () => {
    const r = schedule([
      { id: 'a', duration: 4, start: 0 },
      { id: 'b', duration: 9, start: 0 },
      { id: 'c', duration: 2, dependsOn: ['a', 'b'] },
    ]);
    expect(r.nodes.get('c')!.start).toBe(9); // waits for the longer b
    expect(r.finish).toBe(11);
  });

  it('marks the critical path with zero float', () => {
    const r = schedule([
      { id: 'a', duration: 4, start: 0 },
      { id: 'b', duration: 9, start: 0 },
      { id: 'c', duration: 2, dependsOn: ['a', 'b'] },
    ]);
    expect(r.nodes.get('b')!.critical).toBe(true);
    expect(r.nodes.get('c')!.critical).toBe(true);
    expect(r.nodes.get('a')!.critical).toBe(false);
    expect(r.nodes.get('a')!.float).toBe(5); // 9 - 4
  });

  it('rolls a summary up to span its children', () => {
    const r = schedule([
      { id: 'P', duration: 0 },
      { id: 'a', duration: 4, start: 2, parent: 'P' },
      { id: 'b', duration: 3, dependsOn: ['a'], parent: 'P' },
    ]);
    const sum = r.nodes.get('P')!;
    expect(sum.isSummary).toBe(true);
    expect(sum.start).toBe(2); // earliest child
    expect(sum.end).toBe(9); // 2+4 then +3
  });

  it('a dependency on a summary waits for all its activities', () => {
    const r = schedule([
      { id: 'P', duration: 0 },
      { id: 'a', duration: 4, start: 0, parent: 'P' },
      { id: 'b', duration: 6, start: 0, parent: 'P' },
      { id: 'next', duration: 2, dependsOn: ['P'] },
    ]);
    expect(r.nodes.get('next')!.start).toBe(6); // after the longer of a,b
  });

  it('does not hang on a dependency cycle', () => {
    const r = schedule([
      { id: 'x', duration: 2, dependsOn: ['y'] },
      { id: 'y', duration: 2, dependsOn: ['x'] },
    ]);
    expect(r.nodes.size).toBe(2);
  });
});
