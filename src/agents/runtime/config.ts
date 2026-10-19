/** Runtime configuration from the environment. */

export interface AgentRuntimeConfig {
  mode: 'live' | 'replay';
  model: string;
}

/** Live when ANTHROPIC_API_KEY is set, unless AGENT_MODE=replay. Model from ANTHROPIC_MODEL. */
export function resolveRuntime(env = process.env): AgentRuntimeConfig {
  const model = env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
  const forced = (env.AGENT_MODE || '').toLowerCase();
  if (forced === 'replay') return { mode: 'replay', model };
  if (forced === 'live' || env.ANTHROPIC_API_KEY) return { mode: 'live', model };
  return { mode: 'replay', model };
}
