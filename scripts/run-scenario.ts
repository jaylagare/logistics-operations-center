/**
 * Headless end-to-end run of the default scenario, approving every plan. No formatting, no prompts.
 *   npm run scenario              replay mode (no API key needed)
 *   npm run scenario -- --record  live mode: calls Claude and saves the run as the scenario's replay
 */
import { decide, saveRecording, startScenario, store } from '../src/scenarios/runner';
import type { Recording } from '../src/agents/runtime/llm';
import { fmt } from '../src/core/time';

async function main() {
  const record = process.argv.includes('--record');
  if (record && !process.env.ANTHROPIC_API_KEY) throw new Error('--record needs ANTHROPIC_API_KEY');
  process.env.AGENT_MODE = record ? 'live' : 'replay';
  const rec: Recording = {};
  const opts = { recordTo: record ? rec : undefined, stepDelayMs: 0, followUpDelayMs: 0 };
  store.subscribe((e) => { if (e.type === 'trace') console.log(`\n[${e.entry.run}] ${e.entry.kind.toUpperCase()} · ${e.entry.title}\n${e.entry.body}`); });

  await startScenario(opts);
  for (;;) {
    const a = store.state().approvals.find((x) => x.status === 'pending');
    if (!a) break;
    console.log(`\n>>> Dispatcher approves ${a.id}`);
    await decide(a.id, true, opts);
  }
  const s = store.state();
  console.log('\n=== Final load status');
  for (const l of s.loads) console.log(`${l.id} ${l.cargo.padEnd(16)} ${l.status.padEnd(22)} ETA ${fmt(l.etaMin).padEnd(12)} window ${fmt(l.windowMin)}  ${l.plan ?? ''}`);
  console.log('\n=== Notifications');
  for (const n of s.notifications) console.log(`- to ${n.to} (${n.loadId}): ${n.message}`);
  console.log('\n=== Decision log');
  for (const d of s.decisions) console.log(`- ${fmt(d.timeMin)} ${d.text}`);
  if (record) { saveRecording(rec); console.log('\nSaved the live run as the scenario replay'); }
}
main().catch((e) => { console.error(e); process.exit(1); });
