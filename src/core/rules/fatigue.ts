/**
 * Fatigue rules (simplified for the POC): a driver may work while hours remain; waiting counts as work time;
 * a 7 h continuous rest restores 12 h. Production: HVNL standard hours, then BFM/AFM (backlog F-1101).
 */
import type { Driver } from '../domain';

export const FATIGUE = {
  restH: 7,
  restoredHours: 12,
};

export interface RuleResult {
  ok: boolean;
  reason?: string;
}

/** Can this driver work `hoursNeeded` more hours without a rest? */
export function canWork(driver: Driver, hoursNeeded: number, label = `Driver ${driver.id}`): RuleResult {
  if (hoursNeeded <= driver.hoursLeft) return { ok: true };
  return { ok: false, reason: `${label} needs ${hoursNeeded.toFixed(1)}h of work time but has ${driver.hoursLeft}h left` };
}
