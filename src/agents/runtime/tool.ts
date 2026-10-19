/**
 * Tools are the only way an agent reads or changes the world. Each tool is typed, deterministic
 * and testable on its own; the model chooses which to call and with what arguments.
 */
import type { Store } from '../../state/store';
import type { ToolSpec } from './llm';

export interface ToolContext {
  /** Agent run id, e.g. "initial" or "replan" */
  run: string;
  store: Store;
}

export interface Tool<I = any> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** "policy" for tools whose result is a policy decision (shown differently in traces and UIs) */
  traceAs?: 'tool_result' | 'policy';
  run(input: I, ctx: ToolContext): unknown;
}

export const toSpec = (t: Tool): ToolSpec => ({ name: t.name, description: t.description, input_schema: t.inputSchema });
