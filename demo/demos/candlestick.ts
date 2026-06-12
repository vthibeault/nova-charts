import { CandlestickChart, type OHLC } from 'nova-charts';
import { makeShell, liveMode } from './util.js';

export function mountCandlestickDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Candlestick',
    'Bodies and wicks are spring vectors — live ticks stretch and squash the candles instead of repainting them.',
  );

  let n = 24;
  let last = 100;
  const candle = (): OHLC => {
    const o = last;
    const c = Math.max(o + (Math.random() - 0.49) * 8, 5);
    const h = Math.max(o, c) + Math.random() * 3;
    const l = Math.min(o, c) - Math.random() * 3;
    last = c;
    return {
      o: Math.round(o * 100) / 100,
      h: Math.round(h * 100) / 100,
      l: Math.round(l * 100) / 100,
      c: Math.round(c * 100) / 100,
    };
  };
  const series = (): OHLC[] => {
    last = 80 + Math.random() * 40;
    return Array.from({ length: n }, candle);
  };
  const labels = (): string[] => Array.from({ length: n }, (_, i) => `D${i + 1}`);

  const chart = new CandlestickChart(chartHost, {
    data: { labels: labels(), series: [{ id: 'price', name: 'Price', data: series() }] },
  });

  controls.button(
    'Randomize',
    () => chart.setData({ labels: labels(), series: [{ id: 'price', data: series() }] }),
    true,
  );
  controls.button('Tick last candle', () => {
    const data = chart.data.series[0]!.data as OHLC[];
    const lastCandle = data[data.length - 1]!;
    const c = Math.max(lastCandle.c + (Math.random() - 0.5) * 5, 5);
    const next: OHLC = {
      ...lastCandle,
      c: Math.round(c * 100) / 100,
      h: Math.max(lastCandle.h, c),
      l: Math.min(lastCandle.l, c),
    };
    chart.setData({
      labels: labels(),
      series: [{ id: 'price', data: [...data.slice(0, -1), next] }],
    });
  });
  const live = liveMode(() => {
    const data = chart.data.series[0]!.data as OHLC[];
    last = data[data.length - 1]!.c;
    chart.setData({
      labels: labels(),
      series: [{ id: 'price', data: [...data.slice(1), candle()] }],
    });
  }, 900);
  controls.checkbox('Live ticker', (on) => live.set(on));

  return () => {
    live.stop();
    chart.destroy();
  };
}
