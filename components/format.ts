import type { ActionType, Load } from '@/src/core/domain';

/* ---------- formatting ---------- */
export const fmt = (min: number | null | undefined) => {
  if (min === null || min === undefined) return '—';
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60) % 60).padStart(2, '0')}`;
};
export const aud = (n: number) => `A$${n.toLocaleString('en-AU')}`;
export const START = 21 * 60 + 40;
export const T_END = 1440 + 14 * 60 + 30;

export const ACTION: Record<ActionType, string> = {
  hold_in_place: 'Hold at closure, then Hume',
  reroute_olympic: 'Reroute via Olympic Hwy',
  swap_driver_olympic: 'Fresh driver at Wodonga → Olympic Hwy',
  swap_driver_hume: 'Fresh driver at Wodonga → Hume after reopening',
  rest_at_hub_then_hume: 'Hold at Wodonga, driver rests → Hume',
};
export const CARGO: Record<Load['cargo'], { label: string; color: string }> = {
  perishable: { label: 'Perishable', color: '#0f8a7e' },
  general: { label: 'General', color: '#1f5fbf' },
  dangerous_goods: { label: 'Dangerous goods', color: '#c2410c' },
};

