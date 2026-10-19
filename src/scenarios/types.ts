/**
 * A scenario is data plus a short script: the starting state, the events to inject, and what happens
 * after each dispatcher decision. New scenarios (breakdown, sick driver, dock congestion) plug in here
 * and become the evaluation library that gates releases (backlog F-104, F-1003).
 */
import type { Approval, SimState } from '../core/domain';
import type { Recording } from '../agents/runtime/llm';
import type { Store } from '../state/store';

export interface ScenarioContext {
  store: Store;
  /** Run the scenario's agent on a task; returns when the agent loop finishes */
  runAgent(run: string, task: string): Promise<void>;
  sleep(ms: number): Promise<void>;
  /** Delay before scripted follow-up events (0 in tests) */
  followUpDelayMs: number;
}

export interface Scenario {
  id: string;
  title: string;
  /** Fresh starting state (without runtime fields: mode, model, baseline) */
  initialState(): Omit<SimState, 'mode' | 'model' | 'baseline'>;
  /** Absolute path of the recorded agent turns used in replay mode */
  replayFile: string;
  /** Inject the opening events and run the first agent run */
  start(ctx: ScenarioContext): Promise<void>;
  /** Scripted follow-up after the dispatcher decides on a plan (e.g. a driver drops out) */
  afterDecision?(ctx: ScenarioContext, approval: Approval, approved: boolean): Promise<void>;
}

export type { Recording };
