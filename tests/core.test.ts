/** Domain rules and option evaluation: the numbers the agent relies on. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canWork } from '../src/core/rules/fatigue';
import { routeAllowed } from '../src/core/rules/dangerous-goods';
import { evaluate } from '../src/core/planning/recovery-options';
import { waitItOut } from '../src/core/planning/baseline';
import { fmt } from '../src/core/time';
import { initialState } from '../src/scenarios/runner';

process.env.AGENT_MODE = 'replay';
const state = () => initialState();

test('fatigue: a driver cannot work beyond hours left', () => {
  const d = { id: 'D-1', name: 'x', hub: null, hoursLeft: 2, available: false };
  assert.equal(canWork(d, 1.5).ok, true);
  assert.equal(canWork(d, 2.5).ok, false);
});

test('dangerous goods are banned from the Olympic detour', () => {
  const net = state().network;
  assert.equal(routeAllowed(net, 'olympic', 'dangerous_goods').ok, false);
  assert.equal(routeAllowed(net, 'olympic', 'general').ok, true);
  assert.equal(routeAllowed(net, 'hume', 'dangerous_goods').ok, true);
});

test('perishable load: fresh driver via Olympic arrives 05:13, on time', () => {
  const e = evaluate(state(), { load_id: 'L-1042', action: 'swap_driver_olympic', relief_driver_id: 'D-W1' }, 5);
  assert.equal(e.feasible, true);
  assert.equal(fmt(e.etaMin), '05:13 (+1d)');
  assert.equal(e.onTime, true);
  assert.equal(e.expectedCostAud, 0);
});

test('perishable load: holding at the closure breaks driver hours', () => {
  const e = evaluate(state(), { load_id: 'L-1042', action: 'hold_in_place' }, 5);
  assert.equal(e.feasible, false);
  assert.match(e.reason, /needs 9.8h/);
});

test('dangerous goods load cannot take the Olympic detour', () => {
  const e = evaluate(state(), { load_id: 'L-1051', action: 'swap_driver_olympic', relief_driver_id: 'D-W1' }, 5);
  assert.equal(e.feasible, false);
});

test('a relief driver can be used once per plan', () => {
  const taken = new Set(['D-W1']);
  const e = evaluate(state(), { load_id: 'L-1038', action: 'swap_driver_olympic', relief_driver_id: 'D-W1' }, 5, taken);
  assert.equal(e.feasible, false);
  assert.match(e.reason, /already assigned/);
});

test('wait-it-out baseline costs A$11,500 for a 5h closure', () => {
  const total = waitItOut(state()).reduce((n, b) => n + b.costAud, 0);
  assert.equal(total, 11500);
});
