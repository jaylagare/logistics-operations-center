/**
 * Scenario runner: the one entry point front ends use (web API routes, CLI, tests).
 * Composes the store, the agent runtime, the exception agent and a scenario.
 */
import fs from 'node:fs';
import type { Approval, SimState } from '../core/domain';
import { waitItOut } from '../core/planning/baseline';
import { exceptionAgent } from '../agents/exception/agent';
import { applyItem } from '../agents/exception/actions';
import { resolveRuntime } from '../agents/runtime/config';
import { AnthropicClient, RecordingClient, ReplayClient, type LlmClient, type Recording } from '../agents/runtime/llm';
import { runAgent } from '../agents/runtime/run-agent';
import { configureStore, store } from '../state/store';
import { humeFlood } from './hume-flood/scenario';
import type { Scenario, ScenarioContext } from './types';

export const SCENARIOS: Record<string, Scenario> = { [humeFlood.id]: humeFlood };
export const defaultScenario = humeFlood;

export interface RunnerOptions {
  /** Capture live model turns here (then save with saveRecording) */
  recordTo?: Recording;
  /** Pause between agent steps in replay mode, ms (default 700) */
  stepDelayMs?: number;
  /** Pause before scripted follow-up events, ms (default 2500) */
  followUpDelayMs?: number;
}

/** Fresh state for a scenario, with runtime fields filled in. */
export function initialState(scenario = defaultScenario): SimState {
  const { mode, model } = resolveRuntime();
  const s: SimState = { ...scenario.initialState(), mode, model, baseline: [] };
  s.baseline = waitItOut(s);
  return s;
}

configureStore(() => initialState());

const current = () => SCENARIOS[store.state().scenarioId] ?? defaultScenario;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function llmFor(scenario: Scenario, run: string, o: RunnerOptions): LlmClient {
  const s = store.state();
  if (s.mode === 'live') {
    const live = new AnthropicClient(s.model);
    if (!o.recordTo) return live;
    o.recordTo[run] = [];
    return new RecordingClient(live, o.recordTo[run]);
  }
  const rec: Recording = JSON.parse(fs.readFileSync(scenario.replayFile, 'utf8'));
  if (!rec[run]) throw new Error(`No recorded turns for run "${run}" in ${scenario.replayFile}`);
  return new ReplayClient(rec[run]);
}

function contextFor(scenario: Scenario, o: RunnerOptions): ScenarioContext {
  const agent = exceptionAgent();
  return {
    store,
    sleep,
    followUpDelayMs: o.followUpDelayMs ?? 2500,
    runAgent: async (run, task) => {
      let llm: LlmClient;
      try { llm = llmFor(scenario, run, o); } catch (e: any) { store.trace(run, 'error', 'Agent error', String(e?.message ?? e)); return; }
      await runAgent(agent, {
        run, task, llm, ctx: { run, store },
        pacingMs: llm.kind === 'replay' ? o.stepDelayMs ?? 700 : 0,
      });
    },
  };
}

/** Reset to the scenario's starting state and run until the first dispatcher decision is needed. */
export async function startScenario(o: RunnerOptions = {}, scenario = defaultScenario) {
  const s = store.reset(initialState(scenario));
  s.phase = 'running';
  await scenario.start(contextFor(scenario, o));
  if (s.phase === 'running') s.phase = 'done';
}

/** Record the dispatcher's decision on a plan, execute it, then run any scripted follow-up. */
export async function decide(approvalId: string, approve: boolean, o: RunnerOptions = {}) {
  const s = store.state();
  const scenario = current();
  const a = s.approvals.find((x) => x.id === approvalId);
  if (!a || a.status !== 'pending') return;
  a.status = approve ? 'approved' : 'rejected';
  if (approve) {
    for (const it of a.items.filter((i) => i.policy === 'approve')) applyItem(store, it, 'dispatcher');
    store.feed('ok', `Plan ${a.id} approved by dispatcher`);
  } else {
    store.decision(`Plan ${a.id} rejected by dispatcher`);
    store.feed('info', `Plan ${a.id} rejected; loads stay on hold for manual handling`);
  }
  s.phase = 'running';
  await scenario.afterDecision?.(contextFor(scenario, o), a, approve);
  if (!s.approvals.some((x) => x.status === 'pending')) s.phase = 'done';
  else s.phase = 'awaiting_approval';
}

export function resetScenario(scenario = defaultScenario) {
  return store.reset(initialState(scenario));
}

export function saveRecording(rec: Recording, scenario = defaultScenario) {
  fs.writeFileSync(scenario.replayFile, JSON.stringify(rec, null, 2));
}

export { store };
export type { Approval };
