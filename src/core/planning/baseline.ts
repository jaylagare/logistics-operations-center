/**
 * "Wait it out" baseline: what happens with no agent. Every truck keeps its own driver,
 * who rests at the hub (or holds at the closure), and the road reopens after `reopenHours`.
 * Used to show the value of the agent's plan against doing nothing.
 */
import type { BaselineItem, SimState } from '../domain';
import { evaluate } from './recovery-options';

export const BASELINE_REOPEN_H = 5;

export function waitItOut(state: SimState, reopenHours = BASELINE_REOPEN_H): BaselineItem[] {
  return state.loads.map((l) => {
    const tries = l.stoppedAtClosure ? (['hold_in_place', 'rest_at_hub_then_hume'] as const) : (['rest_at_hub_then_hume'] as const);
    for (const action of tries) {
      const e = evaluate(state, { load_id: l.id, action }, reopenHours);
      if (e.feasible) return { loadId: l.id, etaMin: e.etaMin, costAud: e.expectedCostAud, note: e.reason };
    }
    return { loadId: l.id, etaMin: null, costAud: l.lateCostAud, note: 'No feasible way to wait it out' };
  });
}
