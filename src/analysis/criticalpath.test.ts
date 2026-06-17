import { describe, expect, it } from 'vitest';
import { criticalPath } from './criticalpath.js';

describe('criticalPath', () => {
  it('a strict chain is entirely critical with zero float', () => {
    const r = criticalPath([
      { id: 'a', duration: 3 },
      { id: 'b', duration: 4, dependsOn: ['a'] },
      { id: 'c', duration: 2, dependsOn: ['b'] },
    ]);
    expect(r.projectFinish).toBe(9);
    for (const id of ['a', 'b', 'c']) {
      expect(r.nodes.get(id)!.float).toBe(0);
      expect(r.nodes.get(id)!.critical).toBe(true);
    }
    expect(r.nodes.get('a')!.es).toBe(0);
    expect(r.nodes.get('b')!.es).toBe(3);
    expect(r.nodes.get('c')!.ef).toBe(9);
  });

  it('the shorter parallel branch carries float equal to the difference', () => {
    const r = criticalPath([
      { id: 'long', duration: 10 },
      { id: 'short', duration: 4 },
      { id: 'join', duration: 1, dependsOn: ['long', 'short'] },
    ]);
    expect(r.projectFinish).toBe(11);
    expect(r.nodes.get('long')!.float).toBe(0); // critical
    expect(r.nodes.get('long')!.critical).toBe(true);
    expect(r.nodes.get('short')!.float).toBe(6); // 10 - 4
    expect(r.nodes.get('short')!.critical).toBe(false);
    expect(r.nodes.get('join')!.critical).toBe(true);
  });

  it('a slip within a task float does not move the project finish', () => {
    const base = criticalPath([
      { id: 'long', duration: 10 },
      { id: 'short', duration: 4 },
      { id: 'join', duration: 1, dependsOn: ['long', 'short'] },
    ]);
    const slipped = criticalPath([
      { id: 'long', duration: 10 },
      { id: 'short', duration: 4, slip: 5 }, // within its 6 of float
      { id: 'join', duration: 1, dependsOn: ['long', 'short'] },
    ]);
    expect(slipped.projectFinish).toBe(base.projectFinish); // absorbed by slack
    expect(slipped.nodes.get('short')!.float).toBe(1); // float consumed: 6 - 5
  });

  it('a slip beyond the float pushes the project finish and flips criticality', () => {
    const slipped = criticalPath([
      { id: 'long', duration: 10 },
      { id: 'short', duration: 4, slip: 9 }, // 4 + 9 = 13 > 10
      { id: 'join', duration: 1, dependsOn: ['long', 'short'] },
    ]);
    expect(slipped.projectFinish).toBe(14); // 13 + 1
    expect(slipped.nodes.get('short')!.critical).toBe(true);
    expect(slipped.nodes.get('long')!.critical).toBe(false); // now has float
    expect(slipped.nodes.get('long')!.float).toBe(3);
  });

  it('depth increases along dependencies (used for ripple staggering)', () => {
    const r = criticalPath([
      { id: 'a', duration: 1 },
      { id: 'b', duration: 1, dependsOn: ['a'] },
      { id: 'c', duration: 1, dependsOn: ['b'] },
    ]);
    expect(r.nodes.get('a')!.depth).toBe(0);
    expect(r.nodes.get('b')!.depth).toBe(1);
    expect(r.nodes.get('c')!.depth).toBe(2);
  });

  it('does not hang on a dependency cycle', () => {
    const r = criticalPath([
      { id: 'x', duration: 2, dependsOn: ['y'] },
      { id: 'y', duration: 2, dependsOn: ['x'] },
    ]);
    expect(r.nodes.size).toBe(2);
  });
});
