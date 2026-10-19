import { TRUCKS } from '@/src/demo/mock';
import type { SimState } from '@/src/core/domain';
import { XY, type MapTruck, type P } from './ExceptionWorkspace';
import { CARGO } from './format';

const lerp = (a: P, b: P, f: number): P => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];

/** Mock fleet trucks (not affected by the closure) placed on the schematic map. */
export const mockMapTrucks = (): MapTruck[] =>
  TRUCKS.map((t) => ({
    id: t.truck,
    p: lerp(XY[t.seg[0]], XY[t.seg[1]], t.seg[2]),
    color: t.cargo ? CARGO[t.cargo].color : '#8a94a3',
    note: `${t.where} · ${t.status}`,
    side: (t.dir === 'Southbound' && t.seg[0] !== 'SYD') || t.truck === 'T-02' || t.truck === 'T-26' ? 'left' : 'right',
  }));

/** Fleet-wide numbers combining the live POC loads with the mock fleet. */
export function fleetStats(s: SimState) {
  const started = s.phase !== 'idle';
  const liveOnTime = s.loads.filter((l) => (started ? l.etaMin !== null && l.etaMin <= l.windowMin : true)).length;
  const mockLoads = TRUCKS.filter((t) => t.load && !t.status.startsWith('Delivered'));
  const inFlight = s.loads.length + mockLoads.length;
  const onTime = liveOnTime + mockLoads.length; // mock loads are all on schedule
  const atRisk = s.loads.reduce((n, l) => n + (l.etaMin !== null ? (l.etaMin > l.windowMin ? l.lateCostAud : 0) : started ? l.lateCostAud : 0), 0);
  const driversOnDuty = s.loads.length + TRUCKS.filter((t) => t.driver !== '—').length;
  return { started, inFlight, onTime, atRisk, driversOnDuty };
}
