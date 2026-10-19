'use client';

import { useMemo, useRef, useState } from 'react';
import type { ActionType, Approval, EvaluatedItem, Load, SimState, TraceEntry } from '@/src/core/domain';
import { ACTION, CARGO, START, T_END, aud, fmt } from './format';
import { useSim } from './SimProvider';

export default function ExceptionWorkspace() {
  const { s, busy, post, playT, setPlayT, playing, setPlaying } = useSim();
  const [tab, setTab] = useState<'trace' | 'log' | 'msgs' | 'feed'>('trace');

  const restart = (action: 'start' | 'reset') => {
    setPlaying(false);
    setPlayT(null);
    post('/api/scenario', { action });
  };

  if (!s) return <div className="page">Loading…</div>;

  const started = s.phase !== 'idle';
  const t = playT ?? s.clockMin;
  const init = s.approvals.find((a) => a.run === 'initial');
  const rep = s.approvals.find((a) => a.run === 'replan');
  const pending = s.approvals.find((a) => a.status === 'pending');
  const latest = rep ?? init;
  const reopenMin = latest ? START + latest.closureEstimate.reopenHours * 60 : null;

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <h1>Exception: Hume Highway flooding <span className={`badge ${s.phase === 'idle' ? '' : s.phase === 'done' ? 'ok' : 'alert'}`}>{s.phase === 'idle' ? 'Ready to simulate' : s.phase === 'done' ? 'Resolved' : 'Active'}</span></h1>
          <div className="sub">Exception agent · live POC · Melbourne → Sydney corridor</div>
        </div>
        <div className="controls">
          <button className="primary" disabled={busy || s.phase === 'running' || s.phase === 'replanning'} onClick={() => restart('start')}>
            {started ? 'Run again' : 'Run scenario'}
          </button>
          <button disabled={busy} onClick={() => restart('reset')}>Reset</button>
        </div>
      </div>

      <Stepper s={s} />
      <Kpis s={s} />

      <div className="main">
        <Signals s={s} />
        <div className="panel mapPanel">
          <h2>Corridor <span className="muted">schematic, not to scale</span></h2>
          <CorridorMap s={s} t={t} reopenMin={reopenMin} />
          <Legend />
        </div>
        <AgentPanel
          s={s}
          pending={pending}
          busy={busy}
          onDecide={(ok) => pending && post('/api/approve', { id: pending.id, approve: ok })}
          onPlay={() => { setPlayT((p) => (p === null || p >= T_END ? s.clockMin : p)); setPlaying(true); }}
        />
      </div>

      <div className="panel">
        <h2>
          <span>Delivery timeline <span className="muted">· bar ends at ETA, line marks the deadline</span></span>
          <span className="playback">
            <button disabled={s.phase !== 'done'} onClick={() => { if (playing) setPlaying(false); else { setPlayT((p) => (p === null || p >= T_END ? s.clockMin : p)); setPlaying(true); } }}>
              {playing ? 'Pause' : '▶ Play the night'}
            </button>
            <input type="range" min={s.clockMin} max={T_END} step={5} value={t} disabled={s.phase !== 'done'}
              onChange={(e) => { setPlaying(false); setPlayT(Number(e.target.value)); }} />
          </span>
        </h2>
        <Timeline s={s} t={t} reopenMin={reopenMin} pending={pending} />
      </div>

      <div className="panel">
        <div className="tabs">
          {([['trace', `Agent reasoning (${s.trace.filter((x) => x.kind === 'tool_call').length} tool calls)`], ['log', `Decision log (${s.decisions.length})`], ['msgs', `Customer messages (${s.notifications.length})`], ['feed', `Event feed (${s.feed.length})`]] as const).map(([k, label]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
        {tab === 'trace' && <Trace s={s} />}
        {tab === 'log' && (
          <div className="feed">
            {s.decisions.length === 0 && <div className="empty">Executed decisions are logged here, with who decided: the policy gate or the dispatcher.</div>}
            {s.decisions.map((d) => <div key={d.id}><span className="t">{fmt(d.timeMin)}</span>{d.text}</div>)}
          </div>
        )}
        {tab === 'msgs' && (
          <div>
            {s.notifications.length === 0 && <div className="empty">Customer messages drafted by the agent appear here. They are simulated and never sent.</div>}
            {s.notifications.map((n) => (
              <div key={n.id} className="msg"><div className="muted">{fmt(n.timeMin)} · to <b>{n.to}</b> · {n.loadId} · draft, not sent</div><div>{n.message}</div></div>
            ))}
          </div>
        )}
        {tab === 'feed' && (
          <div className="feed">
            {s.feed.length === 0 && <div className="empty">No events yet.</div>}
            {[...s.feed].sort((x, y) => y.timeMin - x.timeMin || y.id - x.id).map((f) => (
              <div key={f.id} className={f.level}><span className="t">{fmt(f.timeMin)}</span>{f.text}</div>
            ))}
          </div>
        )}
      </div>
      <div className="note">All fleet, driver, road and customer data is simulated. ETAs, costs and the policy gate are computed by code; {s.mode === 'replay' ? 'agent turns are replayed from data/replay.json.' : 'the agent is a live Claude call.'}</div>
    </div>
  );
}

/* ---------- story stepper ---------- */
function Stepper({ s }: { s: SimState }) {
  const init = s.approvals.find((a) => a.run === 'initial');
  const rep = s.approvals.find((a) => a.run === 'replan');
  const steps: [string, boolean][] = [
    ['Flood closes the Hume', s.feed.length > 0],
    ['Agent assesses', s.trace.some((x) => x.run === 'initial' && x.kind === 'tool_call')],
    ['Plan proposed', !!init],
    ['Dispatcher approves', init?.status === 'approved'],
    ['Relief driver drops out', s.feed.some((f) => /called in sick/.test(f.text))],
    ['Agent replans', rep?.status === 'approved'],
  ];
  const cur = steps.findIndex(([, done]) => !done);
  const rejected = s.approvals.some((a) => a.status === 'rejected');
  return (
    <div className="stepper">
      {steps.map(([label, done], i) => (
        <div key={label} className={`step ${done ? 'done' : ''} ${i === cur && s.phase !== 'idle' && !rejected ? 'cur' : ''}`}>
          <span className="n">{done ? '✓' : i + 1}</span>{label}
        </div>
      ))}
    </div>
  );
}

/* ---------- KPI strip ---------- */
function Kpis({ s }: { s: SimState }) {
  const started = s.phase !== 'idle';
  const atRisk = s.loads.reduce((n, l) => n + (l.etaMin !== null ? (l.etaMin > l.windowMin ? l.lateCostAud : 0) : l.lateCostAud), 0);
  const wait = s.baseline.reduce((n, b) => n + b.costAud, 0);
  const onTime = s.loads.filter((l) => l.etaMin !== null && l.etaMin <= l.windowMin).length;
  const relief = s.drivers.filter((d) => d.available && d.hub).map((d) => d.id);
  return (
    <div className="kpis">
      <div className={`kpi ${started ? (atRisk ? 'bad' : 'good') : ''}`}>
        <div className="k">Late cost at risk</div>
        <div className="v">{started ? aud(atRisk) : '—'}</div>
        <div className="d">loads without an on-time plan</div>
      </div>
      <div className="kpi">
        <div className="k">If we just wait it out</div>
        <div className="v muted">{started ? aud(wait) : '—'}</div>
        <div className="d">own drivers rest, Hume reopens in 5h</div>
      </div>
      <div className="kpi">
        <div className="k">Loads on time</div>
        <div className="v">{started ? `${onTime} / ${s.loads.length}` : '—'}</div>
        <div className="d">planned ETA inside the window</div>
      </div>
      <div className="kpi">
        <div className="k">Relief drivers free</div>
        <div className="v">{relief.length}</div>
        <div className="d">{relief.join(', ') || 'none'}</div>
      </div>
    </div>
  );
}

/* ---------- signals ---------- */
const KEY = /(until further notice|3-4 hrs|peak around 02:00|dangerous goods vehicles not permitted[^.]*|2\.0h left)/i;
function Signals({ s }: { s: SimState }) {
  const est = (s.approvals.find((a) => a.run === 'replan') ?? s.approvals.find((a) => a.run === 'initial'))?.closureEstimate;
  return (
    <div className="panel">
      <h2>Incoming signals <span className="muted">{s.reports.length}</span></h2>
      {s.reports.length === 0 && <div className="empty">Road, police, weather and driver reports land here.</div>}
      {[...s.reports].sort((a, b) => b.timeMin - a.timeMin).map((r) => (
        <div key={r.id} className="signal">
          <div className="src"><span className="t">{fmt(r.timeMin)}</span>{r.source}</div>
          <div>{r.text.split(KEY).map((part, i) => (KEY.test(part) ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>))}</div>
        </div>
      ))}
      {s.reports.length > 0 && (
        <div className={`assess ${est ? '' : 'wait'}`}>
          <div className="k">Agent&apos;s read on the closure</div>
          {est ? (
            <>
              <div className="v">Reopens in ~{est.reopenHours}h <span className="muted">(about {fmt(START + est.reopenHours * 60)})</span></div>
              <div className="muted">Confidence: <b>{est.confidence}</b>. Sources disagree, so plans that don&apos;t depend on the reopening are preferred.</div>
            </>
          ) : <div className="muted">Reports conflict: “until further notice” vs “3–4 hrs” vs a 02:00 creek peak. Agent is weighing them…</div>}
        </div>
      )}
    </div>
  );
}

/* ---------- agent panel ---------- */
function AgentPanel({ s, pending, busy, onDecide, onPlay }: { s: SimState; pending?: Approval; busy: boolean; onDecide: (ok: boolean) => void; onPlay: () => void }) {
  const lastThought = [...s.trace].reverse().find((x) => x.kind === 'thinking');
  const lastCall = [...s.trace].reverse().find((x) => x.kind === 'tool_call');

  if (pending) {
    const total = pending.items.reduce((n, i) => n + i.expectedCostAud, 0);
    return (
      <div className="panel rec">
        <h2><span>Agent recommendation</span><span className="badge alert">Needs your approval</span></h2>
        <div className="why">{pending.rationale}</div>
        {pending.items.map((i) => <RecItem key={i.load_id} i={i} s={s} />)}
        <div className="total">Expected late cost of this plan: <b>{aud(total)}</b></div>
        <div className="actions">
          <button className="danger" disabled={busy} onClick={() => onDecide(false)}>Reject</button>
          <button className="primary big" disabled={busy} onClick={() => onDecide(true)}>Approve plan</button>
        </div>
      </div>
    );
  }
  if (s.phase === 'running' || s.phase === 'replanning') {
    return (
      <div className="panel rec">
        <h2><span>Agent</span><span className="badge warn"><span className="pulse" /> {s.phase === 'replanning' ? 'Replanning' : 'Working'}</span></h2>
        {lastThought ? <div className="thought">{lastThought.body}</div> : <div className="empty">Reading the situation…</div>}
        {lastCall && <div className="muted mono small">→ {lastCall.title}</div>}
      </div>
    );
  }
  if (s.phase === 'done') {
    const wait = s.baseline.reduce((n, b) => n + b.costAud, 0);
    const cost = s.loads.reduce((n, l) => n + (l.etaMin !== null && l.etaMin > l.windowMin ? l.lateCostAud : 0), 0);
    const onTime = s.loads.filter((l) => l.etaMin !== null && l.etaMin <= l.windowMin).length;
    const rejected = s.approvals.some((a) => a.status === 'rejected');
    return (
      <div className="panel rec">
        <h2><span>Outcome</span><span className={`badge ${rejected ? 'alert' : 'ok'}`}>{rejected ? 'Plan rejected' : 'Resolved'}</span></h2>
        {rejected ? <div className="why">The dispatcher rejected the plan. Loads stay on hold for manual handling.</div> : (
          <>
            <div className="big">{onTime} of {s.loads.length} loads on time</div>
            <div className="cmp">
              <div><div className="k">Agent plan</div><div className="v">{aud(cost)}</div></div>
              <div><div className="k">Wait it out</div><div className="v muted">{aud(wait)}</div></div>
              <div><div className="k">Avoided</div><div className="v good">{aud(Math.max(0, wait - cost))}</div></div>
            </div>
            <div className="why">The one late load (L-1038) became unavoidable when a relief driver dropped out. The agent kept the perishable load on time instead of saving the smaller penalty, and told the customer at 22:05 rather than at 06:00.</div>
            <button className="primary" onClick={onPlay}>▶ Play the night</button>
          </>
        )}
      </div>
    );
  }
  return (
    <div className="panel rec">
      <h2>Agent</h2>
      <div className="why">It&apos;s 21:40 on the Hume corridor. Four trucks are heading to Sydney overnight, with two spare drivers at the Wodonga hub.</div>
      <div className="why">Click <b>Run scenario</b> to flood the Hume and watch the exception agent work.</div>
    </div>
  );
}

function RecItem({ i, s }: { i: EvaluatedItem; s: SimState }) {
  const l = s.loads.find((x) => x.id === i.load_id)!;
  const c = CARGO[l.cargo];
  return (
    <div className="ritem" style={{ borderLeftColor: c.color }}>
      <div className="row">
        <b>{l.truckId} · {l.id}</b>
        <span className={`badge ${i.policy === 'approve' ? 'warn' : 'ok'}`}>{i.policy === 'approve' ? 'needs approval' : 'done automatically'}</span>
      </div>
      <div className="muted small">{c.label} · {l.customer} · due {fmt(l.windowMin)}</div>
      <div>{ACTION[i.action]}{i.relief_driver_id ? ` · ${i.relief_driver_id}` : ''}</div>
      <div className={i.onTime ? 'goodt' : 'badt'}>ETA {fmt(i.etaMin)} · {i.onTime ? 'on time' : `late · ${aud(i.expectedCostAud)}`}</div>
    </div>
  );
}

/* ---------- corridor map ---------- */
export type P = [number, number];
// Schematic positions (metro-map style): Hume below, Olympic detour above.
export const XY: Record<string, P> = {
  MEL: [70, 470], BEN: [140, 425], WAN: [200, 388], WOD: [265, 345], ALB: [300, 322],
  CLO: [345, 300], HOL: [395, 282], GUN: [455, 258], YAS: [515, 228], GOU: [575, 196], SYD: [640, 120],
  WAG: [325, 225], COO: [365, 168], COW: [425, 118], BAT: [525, 90],
};
const R = {
  south: ['MEL', 'BEN', 'WAN', 'WOD'],
  hume: ['WOD', 'ALB', 'CLO', 'HOL', 'GUN', 'YAS', 'GOU', 'SYD'],
  humeFromClosure: ['CLO', 'HOL', 'GUN', 'YAS', 'GOU', 'SYD'],
  olympic: ['WOD', 'ALB', 'WAG', 'COO', 'COW', 'BAT', 'SYD'],
};
const pts = (r: string[]) => r.map((k) => XY[k]);
const path = (p: P[]) => p.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');
const lerp = (a: P, b: P, f: number): P => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
export function along(p: P[], f: number): P {
  const seg = p.slice(1).map((q, i) => Math.hypot(q[0] - p[i][0], q[1] - p[i][1]));
  let d = Math.max(0, Math.min(1, f)) * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i]) return lerp(p[i], p[i + 1], seg[i] ? d / seg[i] : 0);
    d -= seg[i];
  }
  return p[p.length - 1];
}
const ROUTE_OF: Record<ActionType, { r: string[]; h: number }> = {
  swap_driver_olympic: { r: R.olympic, h: 6.9 },
  reroute_olympic: { r: R.olympic, h: 6.9 },
  swap_driver_hume: { r: R.hume, h: 5.2 },
  rest_at_hub_then_hume: { r: R.hume, h: 5.2 },
  hold_in_place: { r: R.humeFromClosure, h: 4.8 },
};

function truckXY(l: Load, t: number): { p: P; state: string } {
  if (l.action && l.etaMin !== null) {
    const { r, h } = ROUTE_OF[l.action];
    const depart = l.etaMin - h * 60;
    if (t >= l.etaMin) return { p: XY.SYD, state: 'delivered' };
    if (t >= depart) return { p: along(pts(r), (t - depart) / (l.etaMin - depart)), state: 'moving' };
    return { p: l.action === 'hold_in_place' ? XY.CLO : XY.WOD, state: 'waiting' };
  }
  if (l.stoppedAtClosure) return { p: XY.CLO, state: 'stopped' };
  if (l.posFromWodongaH > 0) return { p: lerp(XY.WOD, XY.CLO, Math.min(1, l.posFromWodongaH / 0.4)), state: 'moving' };
  if (l.posFromWodongaH < 0) return { p: along(pts([...R.south].reverse()), -l.posFromWodongaH / 3.5), state: 'moving' };
  return { p: XY.WOD, state: 'waiting' };
}

export interface MapTruck { id: string; p: P; color: string; note?: string; side?: 'left' | 'right' }

export function CorridorMap({ s, t, reopenMin, extra = [], viewBox = '40 45 650 460' }: { s: SimState; t: number; reopenMin: number | null; extra?: MapTruck[]; viewBox?: string }) {
  const active = s.phase !== 'idle';
  const closed = active && (reopenMin === null || t < reopenMin || s.phase !== 'done');
  const pending = s.approvals.find((a) => a.status === 'pending');
  const olyUsed = s.loads.some((l) => l.action === 'swap_driver_olympic' || l.action === 'reroute_olympic');
  const olyPending = pending?.items.some((i) => i.action === 'swap_driver_olympic' || i.action === 'reroute_olympic');
  const m3 = s.drivers.find((d) => d.id === 'D-M3');
  const m3Load = s.loads.find((l) => l.assignedDriverId === 'D-M3');
  const m3Pending = pending?.items.some((i) => i.relief_driver_id === 'D-M3');
  const m3Arr = s.clockMin + 3.5 * 60;

  // Place trucks, fanning out any that share a spot.
  const placed = s.loads.map((l) => ({ l, ...truckXY(l, t) }));
  const boxes: P[] = [];
  const shown = placed.map((x) => {
    const q: P = [x.p[0] + 22, x.p[1] - 4];
    while (boxes.some((b) => Math.abs(b[0] - q[0]) < 48 && Math.abs(b[1] - q[1]) < 21)) q[1] += 21;
    boxes.push(q);
    return { ...x, o: x.p, p: q };
  });
  const extraShown = extra.map((x) => {
    const q: P = [x.side === 'left' ? x.p[0] - 66 : x.p[0] + 22, x.p[1] - 4];
    while (boxes.some((b) => Math.abs(b[0] - q[0]) < 48 && Math.abs(b[1] - q[1]) < 21)) q[1] += 21;
    boxes.push(q);
    return { ...x, o: x.p, p: q };
  });

  const city = (k: string, label: string, dx = 8, dy = 4, anchor: 'start' | 'end' | 'middle' = 'start', strong = false) => (
    <g key={k}>
      <circle cx={XY[k][0]} cy={XY[k][1]} r={strong ? 6 : 3} className={strong ? 'cityHub' : 'city'} />
      <text x={XY[k][0] + dx} y={XY[k][1] + dy} textAnchor={anchor} className={strong ? 'lblStrong' : 'lbl'}>{label}</text>
    </g>
  );

  return (
    <svg viewBox={viewBox} className="map" role="img" aria-label="Corridor map">
      <path d={path(pts(R.south))} className="road" />
      <path d={path(pts(R.hume))} className="road" />
      <path d={path(pts(R.olympic.slice(1)))} className={`road ${olyUsed ? 'used' : olyPending ? 'proposed' : 'alt'}`} />
      {closed && <path d={path(pts(['ALB', 'CLO', 'HOL']))} className="road blocked" />}
      {(m3Load || m3Pending) && <path d={path(pts(R.south))} className={`road ${m3Load ? 'reliefRoute' : 'proposed'}`} />}

      {city('MEL', 'Melbourne', 0, 26, 'start', true)}
      {city('WAN', 'Wangaratta', -10, 4, 'end')}
      {city('WOD', 'Wodonga hub', -10, -14, 'end', true)}
      {city('WAG', 'Wagga Wagga', -10, 4, 'end')}
      {city('COO', 'Cootamundra', -10, 4, 'end')}
      {city('COW', 'Cowra', -10, 0, 'end')}
      {city('BAT', 'Bathurst', 0, -12, 'middle')}
      {city('GUN', 'Gundagai', -4, -10, 'end')}
      {city('YAS', 'Yass', 4, 20)}
      {city('GOU', 'Goulburn', 4, 20)}
      {city('SYD', 'Sydney', -12, 18, 'end', true)}

      <text x={590} y={292} textAnchor="middle" className="roadLbl">Hume Hwy · 5.2h from Wodonga</text>
      <text x={470} y={172} textAnchor="middle" className="roadLbl">Olympic Hwy detour · 6.9h</text>
      {active && <text x={372} y={60} className="dgLbl">Olympic: no dangerous goods tonight</text>}

      {active && (
        <g className={closed ? 'closure' : 'reopened'}>
          <circle cx={XY.CLO[0]} cy={XY.CLO[1]} r={closed ? 16 : 9} className="ring" />
          <text x={XY.CLO[0]} y={XY.CLO[1] + 5} textAnchor="middle" className="x">✕</text>
          <text x={XY.CLO[0] + 22} y={XY.CLO[1] - 20} className="closureLbl">{closed ? 'Flooding · Hume closed' : 'Reopened (agent’s 5h estimate)'}</text>
        </g>
      )}

      {m3 && (m3Load || m3Pending || m3?.available) && (() => {
        const moving = m3Load && t < m3Arr && t >= s.clockMin;
        const p = m3Load ? (moving ? along(pts(R.south), (t - s.clockMin) / (m3Arr - s.clockMin)) : null) : XY.MEL;
        if (!p) return null;
        return (
          <g>
            <circle cx={p[0] + (m3Load ? 0 : 16)} cy={p[1] - (m3Load ? 0 : 12)} r={7} className="driver" />
            <text x={p[0] + (m3Load ? 10 : 26)} y={p[1] - (m3Load ? -4 : 8)} className="lbl">D-M3 {m3Load ? 'driving to Wodonga' : 'spare driver'}</text>
          </g>
        );
      })()}

      {extraShown.map(({ id, o, p, color, note }) => (
        <g key={id} className="truck other">
          <title>{`${id}${note ? ` · ${note}` : ''}`}</title>
          <line x1={o[0]} y1={o[1]} x2={p[0]} y2={p[1]} className="leader" />
          <rect x={p[0]} y={p[1] - 9} width={44} height={18} rx={4} fill="#fff" stroke={color} strokeWidth={1.5} />
          <text x={p[0] + 22} y={p[1] + 4} textAnchor="middle" className="tl" style={{ fill: color }}>{id}</text>
        </g>
      ))}
      {shown.map(({ l, o, p, state: st }) => (
        <g key={l.id} className={`truck ${st}`} style={{ transition: 'transform .3s' }}>
          <line x1={o[0]} y1={o[1]} x2={p[0]} y2={p[1]} className="leader" />
          <rect x={p[0]} y={p[1] - 9} width={44} height={18} rx={4} fill={CARGO[l.cargo].color} />
          <text x={p[0] + 22} y={p[1] + 4} textAnchor="middle" className="tl">{l.truckId}</text>
          {st === 'delivered' && l.etaMin !== null && <text x={p[0] + 48} y={p[1] + 4} className={l.etaMin <= l.windowMin ? 'goodt' : 'badt'} fontSize={11}>{fmt(l.etaMin)}</text>}
        </g>
      ))}
    </svg>
  );
}

export function Legend() {
  return (
    <div className="legend">
      {Object.values(CARGO).map((c) => <span key={c.label}><i style={{ background: c.color }} />{c.label}</span>)}
      <span><i className="ln used" />Chosen detour</span>
      <span><i className="ln proposed" />Proposed</span>
      <span><i className="ln blocked" />Closed</span>
    </div>
  );
}

/* ---------- timeline ---------- */
function Timeline({ s, t, reopenMin, pending }: { s: SimState; t: number; reopenMin: number | null; pending?: Approval }) {
  const T0 = 21 * 60 + 30, T1 = T_END;
  const W = 1000, L = 210, RW = 40, rowH = 62, top = 40;
  const x = (m: number) => L + ((m - T0) / (T1 - T0)) * (W - L - RW);
  const ticks = useMemo(() => Array.from({ length: 9 }, (_, i) => 22 * 60 + i * 120), []);
  const pend = new Map(pending?.items.map((i) => [i.load_id, i]) ?? []);
  const H = top + s.loads.length * rowH + 22;
  const started = s.phase !== 'idle';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="timeline">
      {ticks.map((m) => (
        <g key={m}>
          <line x1={x(m)} y1={top - 6} x2={x(m)} y2={H - 4} className="grid" />
          <text x={x(m)} y={14} textAnchor="middle" className="tick">{fmt(m)}</text>
        </g>
      ))}
      {started && reopenMin && (
        <g>
          <line x1={x(reopenMin)} y1={top - 6} x2={x(reopenMin)} y2={H - 4} className="reopen" />
          <text x={x(reopenMin)} y={H - 6} textAnchor="middle" className="tick">Hume reopening (est.)</text>
        </g>
      )}
      {s.loads.map((l, i) => {
        const y = top + i * rowH + 16;
        const b = s.baseline.find((q) => q.loadId === l.id);
        const p = pend.get(l.id);
        const late = l.etaMin !== null && l.etaMin > l.windowMin;
        return (
          <g key={l.id}>
            <rect x={0} y={y - 12} width={8} height={rowH - 16} rx={2} fill={CARGO[l.cargo].color} />
            <text x={14} y={y + 4} className="rowLbl">{l.truckId} · {l.id}</text>
            <text x={14} y={y + 20} className="rowSub">{CARGO[l.cargo].label} · {l.lateCostAud ? `${aud(l.lateCostAud)} if late` : 'no late cost'}</text>

            <rect x={x(l.windowMin)} y={y - 12} width={Math.max(0, x(T1) - x(l.windowMin))} height={rowH - 16} className="lateZone" />
            {started && b?.etaMin && (
              <g>
                <rect x={x(START)} y={y + 16} width={x(b.etaMin) - x(START)} height={5} rx={2} className="waitBar" />
                <text x={x(b.etaMin) + 4} y={y + 22} className="rowSub">wait it out: {fmt(b.etaMin)}{b.costAud ? ` · ${aud(b.costAud)}` : ''}</text>
              </g>
            )}
            {l.etaMin !== null ? (
              <g>
                <rect x={x(START)} y={y - 4} width={x(l.etaMin) - x(START)} height={12} rx={3} className={late ? 'barLate' : 'barOk'} />
                <text x={!late && x(l.windowMin) - x(l.etaMin) < 62 ? x(l.windowMin) + 5 : x(l.etaMin) + 5} y={y + 6} className={late ? 'badt' : 'goodt'} fontSize={12}>{fmt(l.etaMin)} {late ? 'late' : '✓'}</text>
              </g>
            ) : p && p.etaMin !== null ? (
              <g>
                <rect x={x(START)} y={y - 4} width={x(p.etaMin) - x(START)} height={12} rx={3} className="barPending" />
                <text x={x(l.windowMin) - x(p.etaMin) < 62 && p.etaMin <= l.windowMin ? x(l.windowMin) + 5 : x(p.etaMin) + 5} y={y + 6} className="rowSub">{fmt(p.etaMin)} if approved</text>
              </g>
            ) : started ? (
              <text x={x(START) + 4} y={y + 6} className="badt" fontSize={12}>{l.status === 'Relief driver lost' ? 'Relief driver lost · no plan' : 'No plan yet'}</text>
            ) : null}

            <line x1={x(l.windowMin)} y1={y - 12} x2={x(l.windowMin)} y2={y + rowH - 28} className="deadline" />
            <text x={x(l.windowMin) + 4} y={y - 15} className="dl">due {fmt(l.windowMin)}</text>
          </g>
        );
      })}
      {started && <line x1={x(t)} y1={top - 6} x2={x(t)} y2={H - 4} className="now" />}
    </svg>
  );
}

/* ---------- reasoning trace ---------- */
function Trace({ s }: { s: SimState }) {
  const end = useRef<HTMLDivElement>(null);
  const runs = Array.from(new Set(s.trace.map((t) => t.run)));
  return (
    <div className="trace">
      {s.trace.length === 0 && <div className="empty">Every agent thought and tool call appears here, including the inputs and outputs of each tool.</div>}
      {runs.map((run) => (
        <div key={run}>
          <div className="run">{run === 'initial' ? 'Run 1 · initial disruption' : 'Run 2 · replan'}</div>
          {s.trace.filter((t) => t.run === run).map((t) => <Step key={t.id} t={t} />)}
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}

function Step({ t }: { t: TraceEntry }) {
  const [open, setOpen] = useState(false);
  if (t.kind === 'thinking' || t.kind === 'context' || t.kind === 'error') {
    return (
      <div className={`tstep ${t.kind}`}>
        <div className="label">{t.kind === 'context' ? t.title : t.kind === 'error' ? 'Error' : 'Agent'}</div>
        <div className="text">{t.body}</div>
      </div>
    );
  }
  return (
    <div className={`tstep ${t.kind}`}>
      <div className="label" style={{ cursor: t.body ? 'pointer' : 'default' }} onClick={() => setOpen(!open)}>
        {t.kind === 'tool_call' ? '→ ' : t.kind === 'policy' ? 'Policy gate · ' : '← '}<span className="mono">{t.title}</span>
        {t.body && <span> {open ? '▾' : '▸'}</span>}
      </div>
      {open && t.body && <pre>{t.body}</pre>}
    </div>
  );
}
