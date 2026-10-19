/**
 * Command-line front end for the POC: the same agent, tools and policy gate as the web UI,
 * printed step by step, with real dispatcher approval prompts.
 *
 *   npm run cli                    replay mode (no API key), you approve each plan
 *   npm run cli -- --auto          approve automatically
 *   npm run cli -- --speed 0       no pauses (default 700 ms between agent steps)
 *   npm run cli -- --verbose       also print raw tool inputs and outputs
 *   npm run cli -- --live          call Claude (needs ANTHROPIC_API_KEY)
 *   npm run cli -- --live --record call Claude and save the run as the scenario's replay
 */
import readline from 'node:readline';
import { decide, saveRecording, startScenario, store } from '../src/scenarios/runner';
import type { SimEvent } from '../src/state/store';
import type { Recording } from '../src/agents/runtime/llm';
import { fmt as fmtFull } from '../src/core/time';
import type { Approval, EvaluatedItem } from '../src/core/domain';

const state = () => store.state();

/* ---------- options ---------- */
const argv = process.argv.slice(2);
const flag = (f: string) => argv.includes(f);
const arg = (f: string, d: string) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const LIVE = flag('--live') || flag('--record');
const RECORD = flag('--record');
const AUTO = flag('--auto');
const VERBOSE = flag('--verbose');
const SPEED = Number(arg('--speed', '700'));

/* ---------- terminal helpers (no dependencies) ---------- */
const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const sgr = (code: string) => (s: string) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);
const c = {
  bold: sgr('1'), dim: sgr('2'), red: sgr('31'), green: sgr('32'), yellow: sgr('33'),
  blue: sgr('34'), magenta: sgr('35'), cyan: sgr('36'), gray: sgr('90'), inv: sgr('7'),
};
const W = Math.min(process.stdout.columns || 100, 104);
const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');
const clean = (t: string) => t.replace(/ \(\+\d+d\)/g, '');
const fmt = (m: number | null) => clean(fmtFull(m));
const aud = (n: number) => `A$${n.toLocaleString('en-AU')}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const out = (s = '') => process.stdout.write(s + '\n');

function wrap(text: string, indent: string, width = W, hang = indent) {
  const words = clean(text).replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const ind = lines.length ? hang : indent;
    if (strip(ind + line + ' ' + w).length > width && line) { lines.push(ind + line); line = w; }
    else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push((lines.length ? hang : indent) + line);
  return lines.join('\n');
}

function header(label: string, time?: number | null, tone: (s: string) => string = c.bold) {
  const left = `━━ ${time != null ? fmt(time) + '  ' : ''}${label} `;
  out('\n' + tone(left + '━'.repeat(Math.max(4, W - strip(left).length))));
}

function table(rows: string[][], indent = '  ') {
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => strip(r[i] ?? '').length)));
  rows.forEach((r, ri) => {
    const line = r.map((cell, i) => cell + ' '.repeat(widths[i] - strip(cell).length)).join('  ');
    out(indent + (ri === 0 ? c.gray(strip(line)) : line));
  });
}

const ACTION_SHORT: Record<string, string> = {
  hold_in_place: 'Hold at closure → Hume',
  reroute_olympic: 'Reroute via Olympic, same driver',
  swap_driver_olympic: 'Fresh driver at Wodonga → Olympic',
  swap_driver_hume: 'Fresh driver at Wodonga → Hume',
  rest_at_hub_then_hume: 'Rest at Wodonga → Hume',
};

/* ---------- rendering of agent steps ---------- */
let lastRun = '';
const pendingDecisions: string[] = [];

function callLine(name: string, input: any) {
  const parts: string[] = [];
  if (input.load_id) parts.push(input.load_id);
  if (input.reopen_hours != null) parts.push(`reopen ${input.reopen_hours}h`);
  if (input.relief_driver_id) parts.push(`relief ${input.relief_driver_id}`);
  if (input.to) parts.push(`to ${input.to}`);
  if (name === 'submit_plan') parts.push(`${input.items?.length ?? 0} items, ${input.confidence} confidence`);
  return `${c.magenta('→')} ${c.bold(name)}${c.gray('(' + parts.join(', ') + ')')}`;
}

function renderResult(name: string, input: any, result: any) {
  const I = '      ';
  switch (name) {
    case 'get_disruption_reports':
      for (const r of result) out(wrap(`${c.gray(r.time)} ${c.yellow(r.source)}: ${r.text}`, I));
      break;
    case 'get_affected_loads':
      table([
        ['load', 'cargo', 'window', 'late cost', 'driver', 'hours left', 'position'],
        ...result.map((l: any) => [l.load_id, l.cargo.replace('_', ' '), l.window.replace(/ \(\+\d+d\)/, ''), l.late_cost_aud ? aud(l.late_cost_aud) : '—', l.driver, `${l.driver_hours_left}h`, l.position]),
      ], I);
      break;
    case 'find_relief_drivers':
      if (!result.length) out(I + c.red('none available'));
      for (const d of result) out(`${I}${c.bold(d.driver_id)} ${d.name} · based ${d.based_at} · ${d.hours_available}h · at Wodonga ${d.at_wodonga_by.replace(/ \(\+\d+d\)/, '')}`);
      break;
    case 'evaluate_options':
      table([
        ['option', '', 'ETA', 'late cost', 'why'],
        ...result.map((o: any) => [
          ACTION_SHORT[o.action] ?? o.action,
          o.feasible ? (o.on_time ? c.green('✓ on time') : c.yellow('▲ late')) : c.red('✗ infeasible'),
          o.feasible ? o.eta.replace(/ \(\+\d+d\)/, '') : '—',
          o.feasible ? aud(o.expected_cost_aud) : '—',
          c.gray(clean(o.note)),
        ]),
      ], I);
      break;
    case 'draft_notification':
      out(`${I}${c.cyan('✉')} ${c.bold('to ' + input.to)} ${c.gray('(' + input.load_id + ', drafted, not sent)')}`);
      out(c.cyan(wrap(`"${input.message}"`, I + '  ')));
      break;
    default:
      out(I + c.gray(JSON.stringify(result).slice(0, 200)));
  }
}

function renderPolicy(result: any) {
  if (!result.accepted) {
    header('POLICY GATE · plan refused', null, c.red);
    for (const b of result.blocked) out(`  ${c.red('✗ BLOCKED')} ${b.load_id}: ${b.why}`);
    return;
  }
  const a = state().approvals.find((x) => x.id === result.plan_id)!;
  header(`POLICY GATE · plan ${a.id}`, null, c.yellow);
  out(c.gray('  Code, not the model, decides what runs automatically.'));
  table([
    ['load', 'action', 'ETA', '', 'late cost', 'verdict', 'rule'],
    ...a.items.map((i) => [
      i.load_id,
      ACTION_SHORT[i.action] + (i.relief_driver_id ? ` (${i.relief_driver_id})` : ''),
      fmt(i.etaMin), i.onTime ? c.green('✓') : c.yellow('late'), aud(i.expectedCostAud),
      i.policy === 'auto' ? c.green('AUTO') : c.yellow('APPROVE'),
      c.gray(i.policyRule),
    ]),
  ]);
  flushDecisions();
}

function flushDecisions() {
  for (const d of pendingDecisions.splice(0)) out(/rejected/.test(d) ? `  ${c.red('✗ logged')} ${c.gray(d)}` : `  ${c.green('✔ executed')} ${c.gray(clean(d))}`);
}

function onEvent(e: SimEvent) {
  if (e.type === 'feed') {
    const { entry: f } = e;
    if (/approved by dispatcher|rejected/.test(f.text)) { flushDecisions(); return; } // shown by the prompt
    if (/need dispatcher approval/.test(f.text)) return;
    const mark = f.level === 'alert' ? c.red('!') : f.level === 'ok' ? c.green('✓') : c.gray('·');
    if (/called in sick/.test(f.text)) header('NEW EVENT', f.timeMin, c.red);
    out(wrap(`${mark} ${c.gray(fmt(f.timeMin))} ${f.text}`, '  ', W, '          '));
    return;
  }
  if (e.type === 'decision') { pendingDecisions.push(e.entry.text); return; }

  const t = e.entry;
  const d = e.data as { name: string; input: any; result: any } | undefined;
  if (t.run !== lastRun) {
    lastRun = t.run;
    header(t.run === 'initial' ? 'AGENT · run 1: recover from the closure' : 'AGENT · run 2: replan', state().clockMin, c.blue);
  }
  switch (t.kind) {
    case 'context':
      out(wrap(c.gray('task: ' + t.body), '  '));
      break;
    case 'thinking':
      out('');
      out(c.cyan(wrap('» ' + t.body, '  ')));
      break;
    case 'tool_call':
      out('    ' + callLine(d!.name, d!.input));
      break;
    case 'tool_result':
      renderResult(d!.name, d!.input, d!.result);
      flushDecisions();
      break;
    case 'policy':
      renderPolicy(d!.result);
      break;
    case 'error':
      out(c.red(wrap('✗ ' + t.body, '  ')));
      break;
  }
  if (VERBOSE && d && t.kind !== 'tool_call') out(c.gray(wrap('raw: ' + JSON.stringify(d.result), '      ')));
}

/* ---------- approval prompt ---------- */
// One readline interface for the whole session, so typed or piped answers are never dropped between prompts.
let rl: readline.Interface | null = null;
const lines: string[] = [];
const waiters: ((l: string) => void)[] = [];
function ask(q: string): Promise<string> {
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin, terminal: false });
    rl.on('line', (l) => { const w = waiters.shift(); if (w) w(l); else lines.push(l); });
    rl.on('close', () => { while (waiters.length) waiters.shift()!(''); });
  }
  process.stdout.write(q);
  const queued = lines.shift();
  if (queued !== undefined) { out(queued); return Promise.resolve(queued.trim().toLowerCase()); }
  return new Promise((res) => waiters.push((l) => res(l.trim().toLowerCase())));
}

function showItem(i: EvaluatedItem) {
  out(`    ${i.load_id}  ${ACTION_SHORT[i.action]}${i.relief_driver_id ? ` (${i.relief_driver_id})` : ''}  ETA ${fmt(i.etaMin)}  ${i.onTime ? c.green('on time') : c.yellow('late ' + aud(i.expectedCostAud))}`);
  out(c.gray(`      ${clean(i.reason)}`));
}

async function approve(a: Approval): Promise<boolean> {
  const needs = a.items.filter((i) => i.policy === 'approve');
  header(`DISPATCHER · plan ${a.id} needs your approval`, state().clockMin, c.inv);
  out(c.bold(wrap(a.rationale, '  ')));
  out('');
  out(c.yellow(`  ${needs.length} action(s) need approval:`));
  needs.forEach(showItem);
  out(`  Expected late cost of this plan: ${c.bold(aud(a.items.reduce((n, i) => n + i.expectedCostAud, 0)))}`);
  if (AUTO) { out(c.gray('\n  --auto: approving')); await sleep(SPEED); return true; }
  for (;;) {
    const ans = await ask(`\n  Approve plan ${a.id}? ${c.bold('[y]')}es / ${c.bold('[n]')}o / ${c.bold('[d]')}etails › `);
    if (ans === 'y' || ans === 'yes') return true;
    if (ans === 'n' || ans === 'no') return false;
    if (ans === '' && rl && (rl as any).closed) return false;
    if (ans === 'd' || ans === 'details') {
      out(c.gray(`\n  Closure estimate: reopens in ${a.closureEstimate.reopenHours}h, ${a.closureEstimate.confidence} confidence`));
      out(c.gray('  Every item in the plan:'));
      a.items.forEach(showItem);
    }
  }
}

/* ---------- outcome ---------- */
function outcome() {
  const s = state();
  header('OUTCOME', s.clockMin, c.green);
  table([
    ['load', 'cargo', 'window', 'ETA', '', 'late cost', 'plan'],
    ...s.loads.map((l) => {
      const late = l.etaMin === null || l.etaMin > l.windowMin;
      return [l.id, l.cargo.replace('_', ' '), fmt(l.windowMin), fmt(l.etaMin), late ? c.red('late') : c.green('✓'), late ? aud(l.lateCostAud) : aud(0), c.gray(clean(l.plan ?? 'no plan'))];
    }),
  ]);
  const cost = s.loads.reduce((n, l) => n + (l.etaMin === null || l.etaMin > l.windowMin ? l.lateCostAud : 0), 0);
  const wait = s.baseline.reduce((n, b) => n + b.costAud, 0);
  const onTime = s.loads.filter((l) => l.etaMin !== null && l.etaMin <= l.windowMin).length;
  out('');
  out(`  ${c.bold(`${onTime} of ${s.loads.length} loads on time`)} · agent plan ${c.bold(aud(cost))} vs wait it out ${aud(wait)} · ${c.green('avoided ' + aud(Math.max(0, wait - cost)))}`);
  out(c.gray(`  ${s.notifications.length} customer message(s) drafted, ${s.decisions.length} decisions logged with who decided`));
  header('DECISION LOG', null, c.gray);
  for (const d of s.decisions) out(c.gray(`  ${fmt(d.timeMin)}  ${clean(d.text)}`));
  out('');
}

/* ---------- main ---------- */
async function main() {
  if (LIVE && !process.env.ANTHROPIC_API_KEY) throw new Error('--live needs ANTHROPIC_API_KEY');
  process.env.AGENT_MODE = LIVE ? 'live' : 'replay';
  const rec: Recording = {};
  const opts = { recordTo: RECORD ? rec : undefined, stepDelayMs: SPEED, followUpDelayMs: Math.min(SPEED * 2, 1500) };

  out(c.bold('\nHybrid Logistics Ops Center · exception agent POC'));
  out(c.gray(`Hume Highway flooding · simulated data · agent: ${LIVE ? 'live Claude call' : 'replayed from the recorded run'} · tools, policy and ETAs run live`));
  store.subscribe(onEvent);

  header('DISRUPTION', 21 * 60 + 30, c.red);
  await startScenario(opts);

  for (;;) {
    const a = state().approvals.find((x) => x.status === 'pending');
    if (!a) break;
    const ok = await approve(a);
    out(ok ? c.green(`\n  ✔ Plan ${a.id} approved by dispatcher`) : c.red(`\n  ✗ Plan ${a.id} rejected; loads stay on hold for manual handling`));
    await decide(a.id, ok, opts);
    flushDecisions();
  }

  outcome();
  if (RECORD) { saveRecording(rec); out(c.green('Saved the live run to src/scenarios/hume-flood/replay.json')); }
  rl?.close();
}

main().catch((e) => { console.error(c.red(String(e?.stack ?? e))); process.exit(1); });
