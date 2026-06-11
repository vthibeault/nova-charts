export function fmtValue(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(abs < 1 ? 3 : 2);
}

export function fmtLabel(v: string | number | Date): string {
  if (v instanceof Date) return `${v.getMonth() + 1}/${v.getDate()}`;
  return typeof v === 'number' ? fmtValue(v) : v;
}
