/**
 * Executes approved or auto-approved recovery actions. The only place exception plans change state,
 * whoever decided them (policy or dispatcher), so every change is logged the same way.
 */
import type { EvaluatedItem } from '../../core/domain';
import { ACTION_LABEL } from '../../core/planning/recovery-options';
import { fmt } from '../../core/time';
import type { Store } from '../../state/store';

export function applyItem(store: Store, it: EvaluatedItem, by: 'auto' | 'dispatcher') {
  const s = store.state();
  const load = s.loads.find((l) => l.id === it.load_id)!;
  load.plan = ACTION_LABEL[it.action] + (it.relief_driver_id ? ` (${it.relief_driver_id})` : '');
  load.etaMin = it.etaMin;
  load.action = it.action;
  load.status = it.onTime ? 'Replanned, on time' : 'Replanned, late';
  if (it.relief_driver_id) {
    const r = s.drivers.find((d) => d.id === it.relief_driver_id)!;
    r.available = false;
    load.assignedDriverId = r.id;
  }
  store.decision(`${it.load_id}: ${ACTION_LABEL[it.action]}${it.relief_driver_id ? ` with ${it.relief_driver_id}` : ''} · ETA ${fmt(it.etaMin)} · ${by === 'auto' ? 'auto (policy)' : 'approved by dispatcher'}`);
}
