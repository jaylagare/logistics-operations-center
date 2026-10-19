/**
 * Hume Highway flooding: the Hume closes north of Albury at 21:40. Four loads are affected and
 * Wodonga has two relief drivers. After the dispatcher approves the first plan, one relief driver
 * calls in sick at 22:05 and the agent replans.
 */
import path from 'node:path';
import { fmt } from '../../core/time';
import type { Scenario } from '../types';
import * as seed from './seed';

const INITIAL_TASK = `Disruption at 21:40: the Hume Highway is closed north of Albury (flooding). Truck T-14 has stopped at the closure.
Investigate, decide and submit one recovery plan for every affected load, then notify affected customers.`;

const REPLAN_TASK = (approvedPlanSummary: string) => `Update at 22:05: relief driver D-W2 (F. Brown) has called in sick and is no longer available.
The approved plan used D-W2. Approved plan: ${approvedPlanSummary}
Replan only the load(s) affected by this change. Keep everything else as approved.`;

export const humeFlood: Scenario = {
  id: 'hume-flood',
  title: 'Hume Highway flooding',
  replayFile: path.join(process.cwd(), 'src', 'scenarios', 'hume-flood', 'replay.json'),

  initialState: () => ({
    scenarioId: 'hume-flood',
    phase: 'idle',
    clockMin: seed.START_MIN,
    network: seed.network(),
    hubs: seed.hubs(),
    drivers: seed.drivers(),
    loads: seed.loads(),
    reports: [],
    feed: [],
    trace: [],
    approvals: [],
    notifications: [],
    decisions: [],
    seq: 1,
  }),

  async start({ store, runAgent }) {
    const s = store.state();
    s.reports = seed.reports();
    for (const r of [...s.reports].sort((a, b) => a.timeMin - b.timeMin)) store.feed('alert', `${r.source}: ${r.text}`, r.timeMin);
    const t14 = s.loads.find((l) => l.truckId === 'T-14')!;
    t14.status = 'Stopped at closure';
    store.feed('alert', `T-14 (${t14.id}) stopped at the closure · driver D-A1 has 2.0h left`);
    await runAgent('initial', INITIAL_TASK);
  },

  async afterDecision({ store, runAgent, sleep, followUpDelayMs }, approval, approved) {
    if (!approved || approval.run !== 'initial') return;
    const s = store.state();
    s.phase = 'replanning';
    await sleep(followUpDelayMs);
    s.clockMin = seed.START_MIN + 25;
    s.drivers.find((d) => d.id === 'D-W2')!.available = false;
    const hit = s.loads.find((l) => l.assignedDriverId === 'D-W2');
    if (hit) {
      hit.status = 'Relief driver lost';
      hit.etaMin = null;
      hit.plan = null;
      hit.action = undefined;
      hit.assignedDriverId = hit.driverId;
    }
    store.feed('alert', 'D-W2 (F. Brown) called in sick: no longer available');
    const summary = approval.items.map((i) => `${i.load_id}: ${i.action}${i.relief_driver_id ? ` (${i.relief_driver_id})` : ''}, ETA ${fmt(i.etaMin)}`).join('; ');
    await runAgent('replan', REPLAN_TASK(summary));
  },
};
