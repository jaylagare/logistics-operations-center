/**
 * Deterministic evaluation of recovery actions for a load affected by a closure.
 * Agents call this through tools; the policy engine and executor call it again as a guard.
 * Nothing here involves the model: ETAs, hours and restrictions are computed, never guessed.
 */
import type { ActionType, Driver, EvaluatedItem, Load, PlanItem, SimState } from '../domain';
import { canWork, FATIGUE } from '../rules/fatigue';
import { routeAllowed } from '../rules/dangerous-goods';
import { fmt, hoursToMin as H } from '../time';

export const ACTIONS: ActionType[] = ['hold_in_place', 'reroute_olympic', 'swap_driver_olympic', 'swap_driver_hume', 'rest_at_hub_then_hume'];

export const ACTION_LABEL: Record<ActionType, string> = {
  hold_in_place: 'Hold at closure until reopening',
  reroute_olympic: 'Reroute via Olympic Hwy, same driver',
  swap_driver_olympic: 'Driver swap at Wodonga, then Olympic Hwy',
  swap_driver_hume: 'Driver swap at Wodonga, then Hume after reopening',
  rest_at_hub_then_hume: 'Hold at Wodonga, driver rests, then Hume after reopening',
};

export type Evaluation = Omit<EvaluatedItem, 'policy' | 'policyRule'>;

export function expectedCost(load: Load, etaMin: number | null) {
  if (etaMin === null) return load.lateCostAud;
  return etaMin > load.windowMin ? load.lateCostAud : 0;
}

/**
 * Evaluate one action for one load under an assumed reopening time.
 * `takenRelief` holds relief drivers already used earlier in the same plan (each can be used once).
 */
export function evaluate(state: SimState, item: PlanItem, reopenHours: number, takenRelief: Set<string> = new Set()): Evaluation {
  const net = state.network;
  const load = state.loads.find((l) => l.id === item.load_id);
  const base = { ...item, feasible: false, etaMin: null as number | null, onTime: false, expectedCostAud: 0, reason: '' };
  if (!load) return { ...base, reason: `Unknown load ${item.load_id}` };
  const own = state.drivers.find((d) => d.id === load.driverId)!;
  const now = state.clockMin;
  const toHubH = Math.abs(load.posFromWodongaH);
  const reopenMin = now + H(reopenHours);

  const fail = (reason: string) => ({ ...base, reason, expectedCostAud: load.lateCostAud });
  const ok = (eta: number, reason: string) => ({
    ...base, feasible: true, etaMin: eta, onTime: eta <= load.windowMin, expectedCostAud: expectedCost(load, eta), reason,
  });

  const relief = (): Driver | string => {
    if (!item.relief_driver_id) return 'No relief driver specified';
    const d = state.drivers.find((x) => x.id === item.relief_driver_id);
    if (!d) return `Unknown driver ${item.relief_driver_id}`;
    if (!d.available) return `${d.id} is not available`;
    if (takenRelief.has(d.id)) return `${d.id} is already assigned to another load in this plan`;
    return d;
  };

  switch (item.action) {
    case 'hold_in_place': {
      if (!load.stoppedAtClosure) return fail('Truck is not at the closure');
      const hours = canWork(own, reopenHours + net.humeFromClosureH); // waiting counts as work time
      if (!hours.ok) return fail(hours.reason!);
      return ok(reopenMin + H(net.humeFromClosureH), `Waits ${reopenHours}h, then ${net.humeFromClosureH}h on the Hume`);
    }
    case 'reroute_olympic': {
      const dg = routeAllowed(net, 'olympic', load.cargo);
      if (!dg.ok) return fail(dg.reason!);
      const need = toHubH + net.olympicFromHubH;
      const hours = canWork(own, need);
      if (!hours.ok) return fail(hours.reason!);
      return ok(now + H(need), `${need.toFixed(1)}h via Wodonga and the Olympic Hwy`);
    }
    case 'swap_driver_olympic':
    case 'swap_driver_hume': {
      if (!canWork(own, toHubH).ok) return fail(`Driver ${own.id} cannot reach Wodonga within hours`);
      const r = relief();
      if (typeof r === 'string') return fail(r);
      const arriveHub = now + H(toHubH);
      const reliefReady = now + H(r.travelToWodongaH ?? 0);
      const depart = Math.max(arriveHub, reliefReady) + H(net.swapH);
      if (item.action === 'swap_driver_olympic') {
        const dg = routeAllowed(net, 'olympic', load.cargo);
        if (!dg.ok) return fail(dg.reason!);
        const hours = canWork(r, net.olympicFromHubH, r.id);
        if (!hours.ok) return fail(hours.reason!);
        return ok(depart + H(net.olympicFromHubH), `Swap to ${r.id} at ${fmt(depart)}, then ${net.olympicFromHubH}h via Olympic Hwy`);
      }
      const go = Math.max(depart, reopenMin);
      const hours = canWork(r, (go - depart) / 60 + net.humeFromHubH, r.id);
      if (!hours.ok) return fail(hours.reason!);
      return ok(go + H(net.humeFromHubH), `Swap to ${r.id}, wait for reopening, then ${net.humeFromHubH}h on the Hume`);
    }
    case 'rest_at_hub_then_hume': {
      if (!canWork(own, toHubH).ok) return fail(`Driver ${own.id} cannot reach Wodonga within hours`);
      const restEnd = now + H(toHubH + FATIGUE.restH);
      const go = Math.max(restEnd, reopenMin);
      return ok(go + H(net.humeFromHubH), `Driver rests ${FATIGUE.restH}h at Wodonga, departs ${fmt(go)} via the Hume`);
    }
  }
}
