export interface DemoControls {
  el: HTMLDivElement;
  button(label: string, onClick: () => void, primary?: boolean): HTMLButtonElement;
  checkbox(label: string, onChange: (checked: boolean) => void): HTMLInputElement;
}

export function makeShell(
  host: HTMLElement,
  title: string,
  subtitle: string,
): { controls: DemoControls; chartHost: HTMLDivElement } {
  const header = document.createElement('div');
  header.className = 'demo-header';
  header.innerHTML = `<h2>${title}</h2><p>${subtitle}</p>`;
  host.appendChild(header);

  const controlsEl = document.createElement('div');
  controlsEl.className = 'controls';
  host.appendChild(controlsEl);

  const card = document.createElement('div');
  card.className = 'chart-card';
  host.appendChild(card);

  const chartHost = document.createElement('div');
  chartHost.className = 'chart-host dark-theme';
  card.appendChild(chartHost);

  const controls: DemoControls = {
    el: controlsEl,
    button(label, onClick, primary = false) {
      const b = document.createElement('button');
      b.textContent = label;
      if (primary) b.className = 'primary';
      b.addEventListener('click', onClick);
      controlsEl.appendChild(b);
      return b;
    },
    checkbox(label, onChange) {
      const wrap = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      wrap.appendChild(input);
      wrap.appendChild(document.createTextNode(label));
      input.addEventListener('change', () => onChange(input.checked));
      controlsEl.appendChild(wrap);
      return input;
    },
  };

  return { controls, chartHost };
}

export function randomWalk(n: number, start = 50, step = 14, min = 2, max = 100): number[] {
  const out: number[] = [];
  let v = start + (Math.random() - 0.5) * 30;
  for (let i = 0; i < n; i++) {
    v += (Math.random() - 0.5) * step * 2;
    v = Math.max(min, Math.min(max, v));
    out.push(Math.round(v * 10) / 10);
  }
  return out;
}

export function months(n: number): string[] {
  const all = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return Array.from({ length: n }, (_, i) => all[i % 12]!);
}

/** Manage a setInterval tied to a checkbox; returns a cleanup function. */
export function liveMode(onTick: () => void, ms = 1500): {
  set(on: boolean): void;
  stop(): void;
} {
  let timer: ReturnType<typeof setInterval> | null = null;
  return {
    set(on: boolean) {
      if (on && !timer) timer = setInterval(onTick, ms);
      if (!on && timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
