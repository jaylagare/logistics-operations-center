/** Exception management agent: definition only. The runtime, tools and policy are composed in. */
import { exceptionPolicy } from '../../policy/exception-policy';
import type { AgentDefinition } from '../runtime/run-agent';
import { exceptionTools } from './tools';

export const EXCEPTION_SYSTEM_PROMPT = `You are the exception-management agent in a road freight operations center (Australia, Melbourne–Sydney corridor).
When a disruption happens you: (1) read the reports and judge how long it will last, stating your confidence; (2) find every affected load;
(3) evaluate recovery options per load under your reopening estimate; (4) allocate scarce relief drivers to minimise expected cost and
protect safety-critical and perishable freight; (5) submit ONE plan covering every affected load; (6) draft short customer notifications
for any load whose ETA changes materially or that will be late.
Rules: never exceed driver work hours; dangerous goods restrictions are absolute; be conservative when reports conflict;
the policy gate, not you, decides what needs human approval. Keep your reasoning short and concrete (numbers, not adjectives).`;

export function exceptionAgent(policy = exceptionPolicy()): AgentDefinition {
  return {
    id: 'exception',
    system: EXCEPTION_SYSTEM_PROMPT,
    tools: exceptionTools(policy),
    maxTurns: 14,
  };
}
