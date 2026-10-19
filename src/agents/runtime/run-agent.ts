/**
 * The agent loop, independent of any one agent:
 *   1. send the task, system prompt and tool specs to the model
 *   2. the model replies with reasoning and zero or more tool calls
 *   3. run each tool, return the results
 *   4. repeat until the model makes no tool calls, or the turn cap is reached
 * Every step is written to the store as a trace event (reasoning, call, result), which is the audit
 * trail and what the UIs display.
 */
import type { LlmClient, Message } from './llm';
import { toSpec, type Tool, type ToolContext } from './tool';

export interface AgentDefinition {
  id: string;
  system: string;
  tools: Tool[];
  /** Hard cap on model turns per run */
  maxTurns: number;
}

export interface RunOptions {
  /** Run id shown in traces, e.g. "initial", "replan" */
  run: string;
  /** Task for this run, e.g. the event description */
  task: string;
  llm: LlmClient;
  ctx: ToolContext;
  /** Pause after each step (used to pace replays for demos) */
  pacingMs?: number;
}

export interface RunResult {
  turns: number;
  stoppedBy: 'done' | 'turn-cap' | 'error';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const short = (v: unknown) => {
  const s = JSON.stringify(v, null, 1);
  return s.length > 1400 ? s.slice(0, 1400) + ' …' : s;
};

export async function runAgent(agent: AgentDefinition, o: RunOptions): Promise<RunResult> {
  const { store } = o.ctx;
  const byName = new Map(agent.tools.map((t) => [t.name, t]));
  const specs = agent.tools.map(toSpec);
  const messages: Message[] = [{ role: 'user', text: o.task }];
  const pace = () => (o.pacingMs ? sleep(o.pacingMs) : Promise.resolve());

  store.trace(o.run, 'context', o.run === 'initial' ? 'Event received' : 'Replan triggered', o.task);
  try {
    for (let turn = 1; turn <= agent.maxTurns; turn++) {
      const res = await o.llm.complete({ system: agent.system, tools: specs, messages });
      if (res.text) { store.trace(o.run, 'thinking', 'Agent', res.text); await pace(); }
      messages.push({ role: 'assistant', text: res.text, toolCalls: res.toolCalls });
      if (!res.toolCalls.length) return { turns: turn, stoppedBy: 'done' };

      const results: { id: string; content: string }[] = [];
      for (const call of res.toolCalls) {
        const tool = byName.get(call.name);
        const input = call.input ?? {};
        store.trace(o.run, 'tool_call', call.name, Object.keys(input).length ? short(input) : '', { name: call.name, input });
        const result = tool ? tool.run(input, o.ctx) : { error: `Unknown tool ${call.name}` };
        store.trace(o.run, tool?.traceAs ?? 'tool_result', `${call.name} → result`, short(result), { name: call.name, input, result });
        results.push({ id: call.id, content: JSON.stringify(result) });
        await pace();
      }
      messages.push({ role: 'tool', results });
    }
    store.trace(o.run, 'error', 'Turn cap reached', `Stopped after ${agent.maxTurns} turns; hand over to the dispatcher.`);
    return { turns: agent.maxTurns, stoppedBy: 'turn-cap' };
  } catch (e: any) {
    store.trace(o.run, 'error', 'Agent error', String(e?.message ?? e));
    return { turns: 0, stoppedBy: 'error' };
  }
}
