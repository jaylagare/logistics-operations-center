/** Time helpers. All times are minutes from 00:00 on day 1 of the shift. */

export const hm = (h: number, m = 0) => h * 60 + m;
export const NEXT_DAY = 24 * 60;
export const hoursToMin = (h: number) => Math.round(h * 60);

/** "05:13" or "05:13 (+1d)" */
export function fmt(min: number | null): string {
  if (min === null) return '—';
  const day = Math.floor(min / 1440);
  const m = ((min % 1440) + 1440) % 1440;
  const s = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
  return day > 0 ? `${s} (+${day}d)` : s;
}
