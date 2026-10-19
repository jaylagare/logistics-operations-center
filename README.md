# Hybrid Logistics Operations Center · demo app

A clickable mock-up of the operations center (MVP), with one live part: the **exception management agent** POC on the Exceptions screen.

| Screen | Status |
|---|---|
| Control tower | Mock fleet + live POC data (exception, late cost, map, Wodonga relief drivers) |
| **Exceptions** | **Live POC**: agent, tools, policy gate, approvals, replan |
| Approvals | Live exception approvals (approve/reject works) + mock dispatch plan |
| Dispatch plan | Mock-up of the Dispatch agent (Phase 1) |
| Hub handover | Mock-up of the Hub handover agent; live rows show the exception agent's swaps and rests at Wodonga |
| Loads, Trucks & drivers | Mock fleet + the 4 live loads and relief drivers |
| Decision log | Live decisions tonight + mock history |
| Policies | The exception rules the POC enforces in `src/policy/exception-policy.ts`, plus mock rules for the other agents |

Live items are tagged **Live from POC**; everything else is tagged **Mock**.

## The POC

Proof of concept for the **exception management agent** (Phase 0 of the roadmap): an AI agent that handles a live disruption on the Melbourne–Sydney corridor, allocates scarce relief drivers across affected loads, asks a dispatcher to approve high-risk actions, and replans when the situation changes.

## Scenario: Hume Highway flooding

At 21:40 the Hume Highway closes north of Albury (flooding). Four loads are exposed and Wodonga hub has only two relief drivers.

| Load | Cargo | Window | Cost if late | Situation |
|---|---|---|---|---|
| L-1042 | Perishable | 06:00 | A$9,000 write-off | Stopped at closure; driver has 2.0h left |
| L-1038 | General | 06:00 | A$2,500 penalty | Near Wodonga; driver has 3.5h left |
| L-1051 | Dangerous goods | 10:00 | A$1,500 rebooking | At Wodonga; banned from the Olympic Hwy detour |
| L-1060 | General | 14:00 | none | Approaching Wodonga; driver has 4.0h left |

**Run 1:** the agent reads four reports that conflict on how long the closure will last (authority: "until further notice"; police: "3–4h"; creek peak 02:00), commits to an estimate with a stated confidence, evaluates each load's options, and allocates the two relief drivers to the loads with costed 06:00 windows. The policy gate executes the two holds automatically and sends the two driver swaps to the dispatcher.

**Run 2:** after approval, relief driver D-W2 calls in sick. The agent replans only the affected load, checks whether to move D-W1 off the perishable load (no: that trades A$2,500 for A$9,000), brings D-M3 up from Melbourne, picks the route with the certain ETA, and drafts a notification to the customer.

## Decision points the agent owns

1. **Closure duration** from conflicting, unstructured reports, with a stated confidence
2. **Scope:** which loads are affected
3. **Allocation** of 2 relief drivers across 4 loads with different cargo, windows and late costs
4. **Strategy under uncertainty:** detour now vs wait for reopening
5. **Customer communication:** who to tell, what, and when
6. **Replanning** when an approved plan breaks

Driver-hour maths, ETAs and cargo restrictions are computed by deterministic tools; the agent decides *which* option to take and explains why.

## What is real vs simulated

| Real | Simulated |
|---|---|
| Agent loop with tool calling (Claude API, live mode) | Fleet, drivers, loads, hubs, customers |
| Policy gate (code, not the LLM) | Road closure and weather reports |
| Approval queue and dispatcher decisions | Travel times, fatigue rules (simplified: 7h rest restores 12h) |
| ETA, feasibility and cost calculations | Notifications (drafted, never sent) |
| Decision log and full reasoning trace | |

## Run it

Requires Node.js 18+.

```bash
npm install
npm run dev            # http://localhost:3000
```

Open **Exceptions**, click **Run scenario**, then **Approve plan** twice. When it resolves, click **Play the night** (or drag the slider) to watch the trucks run to Sydney against their deadlines.

The "wait it out" comparison is computed by the same deterministic tools: every truck keeps its own driver, who rests 7h, and the Hume reopens in 5h (A$11,500 in late costs).

### Modes

- **Replay mode** (default, no API key): the agent's turns (its reasoning text and tool calls) are replayed from `src/scenarios/hume-flood/replay.json`. Tools, the policy gate, ETAs and costs still execute live on every run.
- **Live mode:** the agent calls Claude.

```bash
cp .env.example .env.local
# set ANTHROPIC_API_KEY in .env.local, optionally ANTHROPIC_MODEL
npm run dev
```

Record a live run as the scenario's replay (so the demo replays a genuine model run):

```bash
ANTHROPIC_API_KEY=... npm run scenario -- --record
```

### Command-line version

The same agent, tools and policy gate, printed step by step in the terminal, with real approval prompts:

```bash
npm run cli                      # replay mode; you approve each plan (y / n / d for details)
npm run cli -- --auto            # approve automatically
npm run cli -- --speed 0         # no pauses between agent steps (default 700 ms)
npm run cli -- --verbose         # also print raw tool inputs and outputs
npm run cli -- --live            # call Claude (needs ANTHROPIC_API_KEY)
npm run cli -- --live --record   # call Claude and save the run as the scenario's replay
```

It prints: the incoming reports, each agent step (reasoning, tool call, a readable summary of the tool result), the policy gate's verdict per action, the approval prompt, the replan after the driver drops out, and the outcome against the wait-it-out baseline.

Headless run without prompts or formatting: `npm run scenario`

## Tests

```bash
npm test            # 19 tests: rules, option evaluation, policy, agent loop, golden scenario
npm run typecheck
```

The golden scenario test runs the full Hume flood in replay mode and asserts outcomes (3 of 4 loads on time, A$2,500 late cost, perishable load keeps its driver), not wording.

## Code map

The codebase is structured as the skeleton of the product. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the layers, contracts and how to add agents, tools, rules and scenarios.

| Path | What it does |
|---|---|
| `src/core/` | Domain model, time helpers, compliance rules (fatigue, dangerous goods), option evaluation and the wait-it-out baseline. Pure logic, no I/O |
| `src/state/store.ts` | State store and event stream (in-memory today) |
| `src/policy/` | Policy engine and the exception agent's rules and thresholds |
| `src/agents/runtime/` | Agent loop, model clients (Anthropic, replay, recording), tool contract |
| `src/agents/exception/` | Exception agent: prompt, tools, action executor |
| `src/scenarios/` | Scenario contract, runner, and the Hume flood scenario (seed, script, recorded replay) |
| `src/demo/mock.ts` | Mock data for the screens outside the POC |
| `app/`, `components/` | Next.js ops center UI and API routes |
| `scripts/cli.ts`, `scripts/run-scenario.ts` | Terminal front end; headless runner |
| `tests/` | Unit and scenario tests (`node:test` via `tsx`) |

## Limitations

- Single corridor, one scripted scenario plus one replan event
- No persistence: state lives in server memory and resets on restart
- Simplified fatigue model and fixed travel times
- No authentication, multi-tenancy or real integrations (TMS, telematics, road authority feeds)
- The replay shipped with the repo (`src/scenarios/hume-flood/replay.json`) is hand-authored to match the tool outputs; record a live run to replace it
