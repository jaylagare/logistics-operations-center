/** Policy rules for the exception management agent. Thresholds are configuration, not code changes. */
import { PolicyEngine, type PolicyRule } from './engine';

export const EXCEPTION_THRESHOLDS = {
  /** Longest closure estimate for which a hold may run without approval, hours */
  autoHoldMaxHours: 6,
};

export function exceptionRules(t = EXCEPTION_THRESHOLDS): PolicyRule[] {
  return [
    {
      id: 'infeasible-blocked',
      description: 'Any action that breaks driver hours, cargo or availability rules is blocked',
      evaluate: (item) => (item.feasible ? null : { verdict: 'blocked', reason: `Infeasible: ${item.reason}` }),
    },
    {
      id: 'driver-reassignment-approve',
      description: 'Driver reassignment always needs dispatcher approval',
      evaluate: (item) =>
        item.action === 'swap_driver_olympic' || item.action === 'swap_driver_hume'
          ? { verdict: 'approve', reason: 'Driver reassignment requires dispatcher approval' }
          : null,
    },
    {
      id: 'dg-reroute-blocked',
      description: 'Dangerous goods reroutes are blocked',
      evaluate: (item, { load }) =>
        item.action === 'reroute_olympic' && load.cargo === 'dangerous_goods'
          ? { verdict: 'blocked', reason: 'Dangerous goods reroute is blocked' }
          : null,
    },
    {
      id: 'reroute-auto',
      description: 'Reroute on an open, approved road runs automatically',
      evaluate: (item) => (item.action === 'reroute_olympic' ? { verdict: 'auto', reason: 'Reroute on an open approved road' } : null),
    },
    {
      id: 'long-hold-approve',
      description: `Holds for closures longer than ${t.autoHoldMaxHours}h need approval`,
      evaluate: (item, { reopenHours }) =>
        (item.action === 'hold_in_place' || item.action === 'rest_at_hub_then_hume') && reopenHours > t.autoHoldMaxHours
          ? { verdict: 'approve', reason: `Hold longer than ${t.autoHoldMaxHours}h requires approval` }
          : null,
    },
    {
      id: 'late-hold-approve',
      description: 'Holds that miss a delivery window with a late cost need approval',
      evaluate: (item, { load }) =>
        (item.action === 'hold_in_place' || item.action === 'rest_at_hub_then_hume') && !item.onTime && load.lateCostAud > 0
          ? { verdict: 'approve', reason: 'Hold that misses a costed window requires approval' }
          : null,
    },
    {
      id: 'short-hold-auto',
      description: 'Short holds that keep the delivery window run automatically',
      evaluate: (item) =>
        item.action === 'hold_in_place' || item.action === 'rest_at_hub_then_hume'
          ? { verdict: 'auto', reason: 'Hold within threshold and within delivery window' }
          : null,
    },
  ];
}

export const exceptionPolicy = (t = EXCEPTION_THRESHOLDS) => new PolicyEngine(exceptionRules(t));
