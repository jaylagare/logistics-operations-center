/** Agent runtime: the loop, tool dispatch, and the turn cap, using a replayed model. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReplayClient } from '../src/agents/runtime/llm';
import { runAgent, type AgentDefinition } from '../src/agents/runtime/run-agent';
import type { Tool } from '../src/agents/runtime/tool';
import { resetScenario, store } from '../src/scenarios/runner';

process.env.AGENT_MODE = 'replay';

const echo: Tool<{ n: number }> = {
  name: 'double',
  description: 'Double a number',
  inputSchema: { type: 'object', properties: { n: { type: 'number' } }, required: ['n'] },
  run: (i) => ({ result: i.n * 2 }),
};
const agent = (maxTurns = 5): AgentDefinition => ({ id: 'test', system: 'test', tools: [echo], maxTurns });

test('loop runs tools until the model stops calling them', async () => {
  resetScenario();
  const llm = new ReplayClient([{ text: 'double 21', calls: [{ name: 'double', input: { n: 21 } }] }, { text: 'done', calls: [] }]);
  const r = await runAgent(agent(), { run: 't', task: 'go', llm, ctx: { run: 't', store } });
  assert.equal(r.stoppedBy, 'done');
  assert.equal(r.turns, 2);
  const result = store.state().trace.find((t) => t.kind === 'tool_result');
  assert.match(result!.body, /42/);
});

test('unknown tools return an error to the model instead of throwing', async () => {
  resetScenario();
  const llm = new ReplayClient([{ calls: [{ name: 'nope', input: {} }] }]);
  await runAgent(agent(), { run: 't', task: 'go', llm, ctx: { run: 't', store } });
  assert.ok(store.state().trace.some((t) => t.kind === 'tool_result' && /Unknown tool/.test(t.body)));
});

test('turn cap stops a runaway loop and hands over', async () => {
  resetScenario();
  const forever = Array.from({ length: 10 }, () => ({ calls: [{ name: 'double', input: { n: 1 } }] }));
  const r = await runAgent(agent(3), { run: 't', task: 'go', llm: new ReplayClient(forever), ctx: { run: 't', store } });
  assert.equal(r.stoppedBy, 'turn-cap');
  assert.ok(store.state().trace.some((t) => t.title === 'Turn cap reached'));
});
