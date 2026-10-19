/**
 * Golden scenario: the Hume flood end to end in replay mode. This is the seed of the evaluation
 * library that gates releases (backlog F-1003): every scenario asserts outcomes, not wording.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, startScenario, store } from '../src/scenarios/runner';

process.env.AGENT_MODE = 'replay';
const fast = { stepDelayMs: 0, followUpDelayMs: 0 };
const pending = () => store.state().approvals.find((a) => a.status === 'pending');

test('approve both plans: 3 of 4 on time, A$2,500 late cost, 2 customer messages', async () => {
  await startScenario(fast);
  const first = pending()!;
  assert.equal(first.items.filter((i) => i.policy === 'approve').length, 2);
  assert.equal(first.items.filter((i) => i.policy === 'auto').length, 2);
  await decide(first.id, true, fast);
  const replan = pending()!;
  assert.equal(replan.run, 'replan');
  assert.equal(replan.items[0].relief_driver_id, 'D-M3');
  await decide(replan.id, true, fast);

  const s = store.state();
  const onTime = s.loads.filter((l) => l.etaMin !== null && l.etaMin <= l.windowMin).length;
  const late = s.loads.reduce((n, l) => n + (l.etaMin === null || l.etaMin > l.windowMin ? l.lateCostAud : 0), 0);
  assert.equal(onTime, 3);
  assert.equal(late, 2500);
  assert.equal(s.notifications.length, 2);
  assert.equal(s.phase, 'done');
  // The perishable load keeps its driver; the agent did not trade A$9,000 for A$2,500.
  assert.equal(s.loads.find((l) => l.id === 'L-1042')!.assignedDriverId, 'D-W1');
});

test('reject the first plan: nothing reassigned, rejection logged', async () => {
  await startScenario(fast);
  await decide(pending()!.id, false, fast);
  const s = store.state();
  assert.equal(s.phase, 'done');
  assert.ok(s.decisions.some((d) => /rejected by dispatcher/.test(d.text)));
  assert.ok(s.drivers.filter((d) => d.id.startsWith('D-W')).every((d) => d.available));
});
