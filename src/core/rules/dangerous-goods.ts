/**
 * Dangerous goods route rules. Restrictions are absolute: no agent or policy can override them.
 * Production: ADG Code licence, placarding and route restrictions (backlog F-1102).
 */
import type { CargoClass, Network } from '../domain';
import type { RuleResult } from './fatigue';

export type Route = 'hume' | 'olympic';

export function routeAllowed(network: Network, route: Route, cargo: CargoClass): RuleResult {
  if (route === 'olympic' && network.olympicBannedCargo.includes(cargo)) {
    return { ok: false, reason: 'Dangerous goods are not permitted on the Olympic Hwy detour tonight' };
  }
  return { ok: true };
}
