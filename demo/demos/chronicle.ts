import { ChronicleChart, type DriftTask } from 'nova-charts';

export function mountChronicleDemo(host: HTMLElement): () => void {
  const header = document.createElement('div');
  header.className = 'demo-header';
  header.innerHTML =
    '<h2>Chronicle — the plan time-machine</h2><p>Every PM tool shows the <em>current</em> plan and forgets ' +
    'every plan before it. Chronicle keeps each re-plan as a frame: <strong>drag anywhere to scrub through your ' +
    'project’s history</strong> and watch the promises move. Inside each row, down = report date and right = promised ' +
    'finish, so every task draws a <strong>drift comet</strong> — a calm task falls straight down, a slipping one ' +
    'slants right. The faint diagonal is the <em>reality line</em> (a task is done when its comet reaches it), and ' +
    'extending the comet’s trend to that diagonal is the <strong>⌖ honest finish</strong> — the date the task is ' +
    '<em>actually</em> heading for. A comet steeper than the diagonal never meets it: <strong>∞ runaway</strong>. ' +
    '<strong>!</strong> marks a broken promise. Colours follow drift speed, not identity.</p>';
  host.appendChild(header);

  const wrap = document.createElement('div');
  wrap.className = 'chart-card';
  const mount = document.createElement('div');
  mount.style.height = '440px';
  wrap.appendChild(mount);
  host.appendChild(wrap);

  // Eight tasks, eight drift personalities — re-planned every ~10 days.
  const tasks: DriftTask[] = [
    {
      id: 'discovery', name: 'Discovery',
      history: [{ at: 0, finish: 12 }, { at: 8, finish: 12 }],
      actual: 12,
    },
    {
      id: 'design', name: 'Design',
      history: [{ at: 0, finish: 22 }, { at: 10, finish: 25 }, { at: 20, finish: 26 }],
      actual: 26,
    },
    {
      id: 'api', name: 'API build',
      history: [
        { at: 0, finish: 45 }, { at: 10, finish: 49 }, { at: 20, finish: 54 },
        { at: 30, finish: 58 }, { at: 40, finish: 63 }, { at: 50, finish: 67 },
      ],
    },
    {
      id: 'ui', name: 'UI build',
      history: [
        { at: 0, finish: 50 }, { at: 12, finish: 51 }, { at: 26, finish: 50 },
        { at: 40, finish: 51 }, { at: 50, finish: 51 },
      ],
    },
    {
      id: 'payments', name: 'Payments integration',
      history: [
        { at: 0, finish: 40 }, { at: 10, finish: 48 }, { at: 20, finish: 60 },
        { at: 30, finish: 74 }, { at: 40, finish: 90 }, { at: 50, finish: 105 },
      ],
    },
    {
      id: 'migration', name: 'Data migration',
      history: [
        { at: 0, finish: 70 }, { at: 12, finish: 78 }, { at: 24, finish: 84 },
        { at: 36, finish: 80 }, { at: 48, finish: 76 },
      ],
    },
    {
      id: 'qa', name: 'QA hardening',
      history: [
        { at: 0, finish: 62 }, { at: 15, finish: 62 }, { at: 30, finish: 66 },
        { at: 40, finish: 72 }, { at: 50, finish: 78 },
      ],
    },
    {
      id: 'launch', name: 'Launch',
      history: [
        { at: 0, finish: 75 }, { at: 15, finish: 78 }, { at: 30, finish: 84 },
        { at: 40, finish: 92 }, { at: 50, finish: 98 },
      ],
    },
  ];

  const chart = new ChronicleChart(mount, {
    tasks,
    startDate: new Date(2026, 3, 6),
    today: 55,
    deadline: 84,
  });

  const controls = document.createElement('div');
  controls.className = 'controls';
  const btn = (label: string, fn: () => void): void => {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', fn);
    controls.appendChild(b);
  };
  btn('▶ Replay history', () => chart.replay());
  btn('Jump to today', () => chart.setAsOf(55));
  btn('Day 20 (all seemed fine)', () => chart.setAsOf(20));
  host.appendChild(controls);

  return () => chart.destroy();
}
