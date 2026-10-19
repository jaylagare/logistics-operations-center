/** Policy engine: code decides what runs automatically, needs approval, or is blocked. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../src/core/planning/recovery-options';
import { PolicyEngine } from '../src/policy/engine';
import { exceptionPolicy } from '../src/policy/exception-policy';
import { initialState } from '../src/scenarios/runner';

process.env.AGENT_MODE = 'replay';
const s = initialState();
const policy = exceptionPolicy();
const load = (id: string) => s.loads.find((l) => l.id === id)!;
const verdict = (loadId: string, action: any, reopenHours: number, relief?: string) =>
  policy.apply(evaluate(s, { load_id: loadId, action, relief_driver_id: relief }, reopenHours), { load: load(loadId), reopenHours });

test('driver reassignment needs approval', () => {
  assert.equal(verdict('L-1042', 'swap_driver_olympic', 5, 'D-W1').policy, 'approve');
});

test('short hold that keeps the window runs automatically', () => {
  assert.equal(verdict('L-1051', 'rest_at_hub_then_hume', 5).policy, 'auto');
});

test('hold longer than the threshold needs approval', () => {
  assert.equal(verdict('L-1060', 'rest_at_hub_then_hume', 7).policy, 'approve');
});

test('hold that misses a costed window needs approval', () => {
  assert.equal(verdict('L-1038', 'rest_at_hub_then_hume', 5).policy, 'approve');
});

test('infeasible actions are blocked, including DG on the detour', () => {
  assert.equal(verdict('L-1051', 'reroute_olympic', 5).policy, 'blocked');
  assert.equal(verdict('L-1042', 'hold_in_place', 5).policy, 'blocked');
});

test('thresholds are configuration', () => {
  const strict = exceptionPolicy({ autoHoldMaxHours: 4 });
  const e = evaluate(s, { load_id: 'L-1051', action: 'rest_at_hub_then_hume' }, 5);
  assert.equal(strict.apply(e, { load: load('L-1051'), reopenHours: 5 }).policy, 'approve');
});

test('no matching rule means approval, never auto', () => {
  const empty = new PolicyEngine([]);
  const e = evaluate(s, { load_id: 'L-1060', action: 'rest_at_hub_then_hume' }, 5);
  assert.equal(empty.apply(e, { load: load('L-1060'), reopenHours: 5 }).policy, 'approve');
});
