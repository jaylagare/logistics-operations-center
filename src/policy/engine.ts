/**
 * Policy engine: deterministic code, not the model, decides whether an agent's proposed action
 * runs automatically, waits for a person, or is blocked. Rules are evaluated in order; the first
 * rule that returns a verdict wins. If no rule matches, the action needs approval (safe default).
 *
 * Production: rule thresholds are edited by the fleet manager in the policy console, versioned,
 * and every decision records the rule that applied (backlog F-701, F-707).
 */
import type { EvaluatedItem, Load } from '../core/domain';
import type { Evaluation } from '../core/planning/recovery-options';

export type Verdict = EvaluatedItem['policy'];

export interface PolicyContext {
  load: Load;
  reopenHours: number;
}

export interface PolicyRule {
  id: string;
  description: string;
  /** Return a verdict and the reason to show the dispatcher, or null if the rule does not apply. */
  evaluate(item: Evaluation, ctx: PolicyContext): { verdict: Verdict; reason: string } | null;
}

export class PolicyEngine {
  constructor(private readonly rules: PolicyRule[], private readonly fallback: Verdict = 'approve') {}

  apply(item: Evaluation, ctx: PolicyContext): EvaluatedItem {
    for (const rule of this.rules) {
      const r = rule.evaluate(item, ctx);
      if (r) return { ...item, policy: r.verdict, policyRule: r.reason };
    }
    return { ...item, policy: this.fallback, policyRule: 'No rule matched: default requires approval' };
  }

  describe() {
    return this.rules.map((r) => ({ id: r.id, description: r.description }));
  }
}
