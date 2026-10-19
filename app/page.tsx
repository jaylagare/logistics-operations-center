'use client';

import Link from 'next/link';
import { AGENT_ACTIVITY, DISPATCH_PLAN, HUBS, TRUCKS } from '@/src/demo/mock';
import { CorridorMap, Legend } from '@/components/ExceptionWorkspace';
import { fleetStats, mockMapTrucks } from '@/components/fleet';
import { START, aud, fmt } from '@/components/format';
import { Live, Mock, PageHead } from '@/components/Shell';
import { useSim } from '@/components/SimProvider';

export default function ControlTower() {
  const { s, now } = useSim();
  if (!s) return <div className="page">Loading…</div>;
  const st = fleetStats(s);
  const latest = s.approvals.find((a) => a.run === 'replan') ?? s.approvals.find((a) => a.run === 'initial');
  const reopenMin = latest ? START + latest.closureEstimate.reopenHours * 60 : null;
  const pending = s.approvals.filter((a) => a.status === 'pending');
  const active = ['running', 'awaiting_approval', 'replanning'].includes(s.phase);
  const thoughts = s.trace.filter((x) => x.kind === 'thinking').slice(-3).reverse();
  const relief = s.drivers.filter((d) => d.hub === 'WOD' && d.available).length;

  return (
    <div className="page">
      <PageHead title="Control tower" sub="Tonight across the Melbourne ⇄ Sydney corridor" />

      <div className="kpis six">
        <Kpi k="Loads in flight" v={String(st.inFlight)} d={`${TRUCKS.length + s.loads.length} trucks on the network`} />
        <Kpi k="On-time forecast" v={`${st.onTime} / ${st.inFlight}`} d="ETA inside the delivery window" tone={st.onTime < st.inFlight ? 'bad' : undefined} />
        <Kpi k="Late cost at risk" v={aud(st.atRisk)} d={st.started ? 'loads without an on-time plan' : 'no disruption yet'} tone={st.atRisk ? 'bad' : st.started ? 'good' : undefined} live />
        <Kpi k="Active exceptions" v={String(active ? 1 : 0)} d={s.phase === 'done' ? '1 resolved tonight' : active ? 'Hume Highway flooding' : 'all clear'} tone={active ? 'bad' : undefined} live />
        <Kpi k="Drivers on duty" v={String(st.driversOnDuty)} d={`${relief} relief at Wodonga`} />
        <Kpi k="Freight km / driver-hour" v="58" d="north-star metric · 4-week avg" mock />
      </div>

      <div className="ct">
        <div className="panel mapPanel">
          <h2><span>Network <span className="muted">· schematic, hover a truck for details</span></span><span className="muted small">filled = affected by tonight&apos;s closure · outlined = rest of fleet</span></h2>
          <CorridorMap s={s} t={now} reopenMin={reopenMin} extra={mockMapTrucks()} viewBox="-30 40 740 470" />
          <Legend />
        </div>

        <div className="col">
          <div className="panel">
            <h2><span>Needs attention</span><Live /></h2>
            {s.phase === 'idle' && (
              <div className="attn calm">
                <b>No active exceptions</b>
                <div className="muted small">The exception agent is watching road, weather and driver feeds.</div>
                <Link href="/exceptions" className="btn primary">Simulate: Hume Highway flooding →</Link>
              </div>
            )}
            {s.phase !== 'idle' && (
              <Link href="/exceptions" className={`attn ${active ? 'hot' : 'resolved'}`}>
                <div className="row"><b>Hume Hwy closed north of Albury</b><span className={`badge ${active ? 'alert' : 'ok'}`}>{s.phase === 'done' ? 'Resolved' : s.phase === 'awaiting_approval' ? 'Needs approval' : 'Agent working'}</span></div>
                <div className="small">4 loads affected · {latest ? `reopening est. ${fmt(reopenMin)} (${latest.closureEstimate.confidence} confidence)` : 'assessing reports'}</div>
                <div className="small muted">{s.phase === 'done' ? `Late cost ${aud(st.atRisk)} vs ${aud(s.baseline.reduce((n, b) => n + b.costAud, 0))} if we wait it out` : 'Open the exception →'}</div>
              </Link>
            )}
            {pending.map((a) => (
              <Link key={a.id} href="/exceptions" className="attn warnbox">
                <div className="row"><b>Plan {a.id} needs your approval</b><span className="badge warn">Exception agent</span></div>
                <div className="small">{a.items.filter((i) => i.policy === 'approve').length} driver reassignment(s) · expected late cost {aud(a.items.reduce((n, i) => n + i.expectedCostAud, 0))}</div>
              </Link>
            ))}
            <Link href="/dispatch" className="attn">
              <div className="row"><b>{DISPATCH_PLAN.id}: tomorrow&apos;s plan ready for review</b><Mock /></div>
              <div className="small muted">Dispatch agent · {DISPATCH_PLAN.rows.length} loads shown · 63 freight km per driver-hour</div>
            </Link>
            <Link href="/hubs" className="attn">
              <div className="row"><b>T-35 driver on rest break at Wodonga</b><Mock /></div>
              <div className="small muted">Departs 23:00 · L-2030 still on time for 07:00</div>
            </Link>
          </div>

          <div className="panel">
            <h2>Agent activity</h2>
            <div className="activity">
              {thoughts.map((t) => (
                <div key={t.id}><span className="tag exc">Exception</span><span className="t">{fmt(s.clockMin)}</span>{t.body.length > 170 ? t.body.slice(0, 170) + '…' : t.body}</div>
              ))}
              {[...AGENT_ACTIVITY].reverse().map((a) => (
                <div key={a.time + a.text}><span className={`tag ${a.agent === 'Dispatch' ? 'dsp' : 'hub'}`}>{a.agent}</span><span className="t">{a.time}</span>{a.text}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="hubs">
        {HUBS.map((h) => (
          <Link key={h.id} href="/hubs" className="panel hubcard">
            <div className="row"><b>{h.name}</b>{h.id === 'WOD' ? <Live /> : <Mock />}</div>
            <div className="muted small">{h.note}</div>
            <div className="hubstats">
              <div><div className="v">{h.docksBusy}/{h.docks}</div><div className="k">docks busy</div></div>
              <div><div className="v">{h.id === 'WOD' ? relief : h.id === 'MEL' ? (s.drivers.find((d) => d.id === 'D-M3')?.available ? 1 : 0) : 0}</div><div className="k">spare drivers</div></div>
              <div><div className="v">{h.id === 'WOD' ? 5 : h.id === 'SYD' ? 2 : 1}</div><div className="k">trucks on site</div></div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Kpi({ k, v, d, tone, live, mock }: { k: string; v: string; d: string; tone?: 'bad' | 'good'; live?: boolean; mock?: boolean }) {
  return (
    <div className={`kpi ${tone ?? ''}`}>
      <div className="k">{k}{live && <span className="dot live" title="Live from POC" />}{mock && <span className="mockdot" title="Mock">mock</span>}</div>
      <div className="v">{v}</div>
      <div className="d">{d}</div>
    </div>
  );
}
