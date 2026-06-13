import { SankeyChart, type SankeyLink } from 'nova-charts';
import { makeShell, liveMode } from './util.js';

export function mountSankeyDemo(host: HTMLElement): () => void {
  const { controls, chartHost } = makeShell(
    host,
    'Sankey',
    'Flow ribbons and node bars are all springs — change the flows and the diagram re-balances, ribbons thickening and sliding.',
  );

  const nodes = [
    { id: 'ads', name: 'Ads' },
    { id: 'organic', name: 'Organic' },
    { id: 'referral', name: 'Referral' },
    { id: 'visit', name: 'Visits' },
    { id: 'signup', name: 'Signups' },
    { id: 'bounce', name: 'Bounced' },
    { id: 'paid', name: 'Paid plan' },
    { id: 'free', name: 'Free plan' },
  ];
  const flow = (lo: number, hi: number): number => Math.round(lo + Math.random() * (hi - lo));
  const links = (): SankeyLink[] => {
    const ads = flow(40, 120);
    const organic = flow(60, 160);
    const referral = flow(20, 80);
    const total = ads + organic + referral;
    const signup = Math.round(total * (0.3 + Math.random() * 0.3));
    const paid = Math.round(signup * (0.2 + Math.random() * 0.4));
    return [
      { source: 'ads', target: 'visit', value: ads },
      { source: 'organic', target: 'visit', value: organic },
      { source: 'referral', target: 'visit', value: referral },
      { source: 'visit', target: 'signup', value: signup },
      { source: 'visit', target: 'bounce', value: total - signup },
      { source: 'signup', target: 'paid', value: paid },
      { source: 'signup', target: 'free', value: signup - paid },
    ];
  };

  const chart = new SankeyChart(chartHost, {
    nodes,
    links: links(),
    margin: { top: 16, right: 80, bottom: 16, left: 16 },
  });

  controls.button('Randomize flows', () => chart.setFlows(nodes, links()), true);
  const live = liveMode(() => chart.setFlows(nodes, links()), 2000);
  controls.checkbox('Live mode', (on) => live.set(on));

  return () => {
    live.stop();
    chart.destroy();
  };
}
