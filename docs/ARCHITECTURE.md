# Architecture

The POC is organised as the skeleton of the product: each layer has one job, depends only on the
layers below it, and can be replaced without touching the others. The exception agent and the Hume
flood scenario are the first things built on it; the dispatch and hub handover agents plug into the
same runtime, policy engine and store.

## Layers

```
 Front ends      app/ (Next.js ops center)    scripts/cli.ts (terminal)    tests/
                        │                            │                       │
 Scenarios       src/scenarios/  runner · scenario contract · hume-flood (seed, script, replay)
                        │
 Agents          src/agents/     runtime (loop, LLM clients, tool contract) · exception (prompt, tools, actions)
                        │
 Policy          src/policy/     engine (ordered rules, safe default) · exception-policy (rules + thresholds)
                        │
 State           src/state/      store + event stream (in-memory today)
                        │
 Core            src/core/       domain model · time · rules (fatigue, dangerous goods) · planning (options, baseline)
```

**Dependency rule:** a layer may import from layers below it, never above. `src/core` imports nothing
from the rest of the codebase; it is pure logic and the most heavily tested layer.

## Responsibilities

| Layer | Owns | Never does |
|---|---|---|
| Core | Domain types, compliance rules, ETA and cost calculation | Call a model, read or write state |
| State | The current shift's state and the event stream every UI reads | Business decisions |
| Policy | Whether a proposed action runs automatically, needs approval, or is blocked | Generate actions |
| Agents | The loop: reason, call tools, read results, repeat; tool definitions per agent | Compute numbers itself; bypass the policy engine |
| Scenarios | Starting data, injected events, scripted follow-ups, recorded model turns | Contain agent logic |
| Front ends | Display state and events; send dispatcher decisions | Change state directly (they call the runner) |

## Key contracts

| Contract | File | Purpose |
|---|---|---|
| `LlmClient` | `src/agents/runtime/llm.ts` | One `complete()` call; Anthropic, replay and recording clients implement it |
| `Tool` | `src/agents/runtime/tool.ts` | Name, JSON schema, `run(input, ctx)`; the only way an agent touches state |
| `AgentDefinition` | `src/agents/runtime/run-agent.ts` | System prompt, tools, turn cap |
| `PolicyRule` / `PolicyEngine` | `src/policy/engine.ts` | Ordered rules; first verdict wins; no match means approval |
| `Store` | `src/state/store.ts` | State access, ids, feed/trace/decision events, subscriptions |
| `Scenario` | `src/scenarios/types.ts` | `initialState()`, `start()`, `afterDecision()`, replay file |

## How to extend

| To add | Do this | Touches |
|---|---|---|
| A tool | Write a `Tool` in the agent's `tools.ts` and add it to the returned list | One file + a test |
| A policy rule or threshold | Add a `PolicyRule` (or change `EXCEPTION_THRESHOLDS`) | `src/policy/` + a test |
| An agent (e.g. dispatch) | New folder `src/agents/dispatch/` with `agent.ts`, `tools.ts`, `actions.ts`; its own policy rules in `src/policy/` | No changes to the runtime |
| A scenario | New folder under `src/scenarios/`, register it in `runner.ts`, record a replay, add a golden test | Scenarios + tests |
| A model provider or gateway | Implement `LlmClient` | `src/agents/runtime/llm.ts` |
| A database | Implement `Store` against Postgres (event table + snapshots) | `src/state/` |
| A real data source (TMS, telematics, road feeds) | An adapter that writes into the store; tools stay unchanged | New `src/integrations/` |

## Behaviour worth knowing

- **Numbers are never the model's.** `evaluate_options` and `submit_plan` call `core/planning`; `submit_plan` re-evaluates every item before the policy engine sees it.
- **Safe defaults.** An unmatched policy rule means approval; an unknown tool returns an error to the model; the loop stops at the turn cap and logs a hand-over.
- **Replay is a model client, not a branch.** Replay mode swaps `AnthropicClient` for `ReplayClient`; tools, policy and ETAs still run for real, so replays are valid regression tests.
- **One event stream.** The store emits `feed`, `trace` and `decision` events; the CLI prints them, the web UI reads snapshots, tests assert on state.

## From POC to product

| Area | POC today | Product (backlog) |
|---|---|---|
| State | In-memory singleton, resets on restart | Event store with replay (F-102), multi-tenant (F-105) |
| Data | Seeded scenario | TMS, telematics, EWD, road and roster adapters (F-201 to F-208) |
| Model access | Direct Anthropic client | Model gateway: pinning, fallback, cost tracking (F-1002, F-1006) |
| Policy | Rules in code with config thresholds | Policy console with versioning and second approver (F-707) |
| Evals | 1 golden scenario + unit tests | Scenario library of 30+ gating each release (F-1003) |
| Safety | Hard rules, re-checks, turn cap, approvals | Plus prompt-injection guardrails (F-1005), autonomy levels and kill switch (F-706), shadow mode (F-709) |
| Agents | Exception | Dispatch (MVP), exception and hub handover (Phase 2), orchestrator (F-1007) |
| Security | None | SSO, roles, audit retention (F-103, F-1104, F-1105) |
