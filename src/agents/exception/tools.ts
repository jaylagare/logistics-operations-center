/**
 * Tools for the exception management agent. Read tools return facts; evaluate_options computes;
 * submit_plan routes every proposed action through the policy engine before anything executes.
 */
import type { Approval, EvaluatedItem, PlanItem } from '../../core/domain';
import { ACTION_LABEL, ACTIONS, evaluate } from '../../core/planning/recovery-options';
import { fmt } from '../../core/time';
import type { PolicyEngine } from '../../policy/engine';
import type { Tool } from '../runtime/tool';
import { applyItem } from './actions';

const noInput = { type: 'object', properties: {}, required: [] };

export function exceptionTools(policy: PolicyEngine): Tool[] {
  const getDisruptionReports: Tool = {
    name: 'get_disruption_reports',
    description: 'Return all current reports about the disruption (road authority, driver messages, weather). Reports can conflict; judge their reliability.',
    inputSchema: noInput,
    run: (_, { store }) => store.state().reports.map((r) => ({ id: r.id, source: r.source, time: fmt(r.timeMin), text: r.text })),
  };

  const getAffectedLoads: Tool = {
    name: 'get_affected_loads',
    description: 'Return loads on the affected corridor: cargo class, customer, delivery window, cost of being late, truck position, and the current driver with work hours left.',
    inputSchema: noInput,
    run: (_, { store }) => {
      const s = store.state();
      return s.loads.map((l) => {
        const d = s.drivers.find((x) => x.id === l.driverId)!;
        return {
          load_id: l.id, customer: l.customer, cargo: l.cargo, description: l.description, truck: l.truckId,
          window: fmt(l.windowMin), late_cost_aud: l.lateCostAud, late_cost_note: l.lateCostNote,
          position: l.stoppedAtClosure ? 'Stopped at the closure' : l.posFromWodongaH === 0 ? 'At Wodonga hub' : l.posFromWodongaH > 0
            ? `${Math.round(l.posFromWodongaH * 80)} km north of Wodonga` : `${Math.round(-l.posFromWodongaH * 80)} km south of Wodonga`,
          driver: d.id, driver_hours_left: d.hoursLeft, status: l.status,
        };
      });
    },
  };

  const findReliefDrivers: Tool = {
    name: 'find_relief_drivers',
    description: 'Return relief drivers who could take over a truck at Wodonga hub, with hours available and when they can be at Wodonga.',
    inputSchema: noInput,
    run: (_, { store }) => {
      const s = store.state();
      return s.drivers.filter((d) => d.hub && d.available).map((d) => ({
        driver_id: d.id, name: d.name, based_at: d.hub, hours_available: d.hoursLeft,
        at_wodonga_by: fmt(s.clockMin + Math.round((d.travelToWodongaH ?? 0) * 60)),
      }));
    },
  };

  const evaluateOptions: Tool<{ load_id: string; reopen_hours: number; relief_driver_id?: string }> = {
    name: 'evaluate_options',
    description: 'For one load, evaluate every recovery action under an assumed reopening time: feasibility (driver hours, cargo restrictions), ETA, on-time, and expected cost. Pass relief_driver_id to evaluate swap actions with that driver.',
    inputSchema: {
      type: 'object',
      properties: {
        load_id: { type: 'string' },
        reopen_hours: { type: 'number', description: 'Your estimate of hours until the Hume reopens' },
        relief_driver_id: { type: 'string', description: 'Optional relief driver for swap actions' },
      },
      required: ['load_id', 'reopen_hours'],
    },
    run: (input, { store }) => {
      const s = store.state();
      if (!s.loads.some((l) => l.id === input.load_id)) return { error: `Unknown load ${input.load_id}` };
      return ACTIONS.map((action) => {
        const e = evaluate(s, { load_id: input.load_id, action, relief_driver_id: input.relief_driver_id }, input.reopen_hours);
        return { action, label: ACTION_LABEL[action], feasible: e.feasible, eta: fmt(e.etaMin), on_time: e.onTime, expected_cost_aud: e.expectedCostAud, note: e.reason };
      });
    },
  };

  const submitPlan: Tool<{ reopen_hours: number; confidence: string; rationale: string; items: PlanItem[] }> = {
    name: 'submit_plan',
    description: 'Submit one recovery action per affected load. The policy gate decides which items execute automatically and which need dispatcher approval. Each relief driver can be used once.',
    traceAs: 'policy',
    inputSchema: {
      type: 'object',
      properties: {
        reopen_hours: { type: 'number' },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        rationale: { type: 'string', description: 'Short explanation for the dispatcher: the trade-offs and why this plan' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { load_id: { type: 'string' }, action: { type: 'string', enum: ACTIONS }, relief_driver_id: { type: 'string' } },
            required: ['load_id', 'action'],
          },
        },
      },
      required: ['reopen_hours', 'confidence', 'rationale', 'items'],
    },
    run: (input, { run, store }) => {
      const s = store.state();
      const taken = new Set<string>();
      const items: EvaluatedItem[] = input.items.map((it) => {
        const load = s.loads.find((l) => l.id === it.load_id);
        const e = evaluate(s, it, input.reopen_hours, taken); // re-check: never trust the model's numbers
        if (e.feasible && it.relief_driver_id) taken.add(it.relief_driver_id);
        return load ? policy.apply(e, { load, reopenHours: input.reopen_hours }) : { ...e, policy: 'blocked', policyRule: 'Unknown load' };
      });
      const blocked = items.filter((i) => i.policy === 'blocked');
      if (blocked.length) {
        return { accepted: false, blocked: blocked.map((b) => ({ load_id: b.load_id, why: b.policyRule })), hint: 'Fix the blocked items and resubmit.' };
      }
      const approval: Approval = {
        id: `P-${store.nextId()}`, run, createdMin: s.clockMin, rationale: input.rationale,
        closureEstimate: { reopenHours: input.reopen_hours, confidence: input.confidence }, items, status: 'pending',
      };
      for (const it of items.filter((i) => i.policy === 'auto')) applyItem(store, it, 'auto');
      const needs = items.filter((i) => i.policy === 'approve');
      if (needs.length) {
        s.approvals.push(approval);
        s.phase = 'awaiting_approval';
        store.feed('alert', `Plan ${approval.id}: ${needs.length} action(s) need dispatcher approval`);
      } else {
        approval.status = 'approved';
        s.approvals.push(approval);
      }
      return {
        accepted: true, plan_id: approval.id,
        auto_executed: items.filter((i) => i.policy === 'auto').map((i) => ({ load_id: i.load_id, action: i.action, eta: fmt(i.etaMin) })),
        awaiting_approval: needs.map((i) => ({ load_id: i.load_id, action: i.action, rule: i.policyRule })),
      };
    },
  };

  const draftNotification: Tool<{ load_id: string; to: string; message: string }> = {
    name: 'draft_notification',
    description: 'Queue a message to a customer or hub about a load. Write it for the recipient: plain language, new ETA, what happens next.',
    inputSchema: {
      type: 'object',
      properties: { load_id: { type: 'string' }, to: { type: 'string' }, message: { type: 'string' } },
      required: ['load_id', 'to', 'message'],
    },
    run: (input, { store }) => {
      const s = store.state();
      s.notifications.push({ id: store.nextId(), timeMin: s.clockMin, to: input.to, loadId: input.load_id, message: input.message });
      return { queued: true };
    },
  };

  return [getDisruptionReports, getAffectedLoads, findReliefDrivers, evaluateOptions, submitPlan, draftNotification];
}
