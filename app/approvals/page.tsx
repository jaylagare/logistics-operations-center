'use client';

import Link from 'next/link';
import { DISPATCH_PLAN, HUB_SUGGESTIONS } from '@/src/demo/mock';
import { ACTION, CARGO, aud, fmt } from '@/components/format';
import { Live, Mock, PageHead } from '@/components/Shell';
import { useSim } from '@/components/SimProvider';

export default function Approvals() {
  const { s, busy, post } = useSim();
  if (!s) return <div className="page">Loading…</div>;
  const pending = s.approvals.filter((a) => a.status === 'pending');
  const decided = s.approvals.filter((a) => a.status !== 'pending');

  return (
    <div className="page">
      <PageHead title="Approvals" sub="Actions the policy gate sends to a person, from every agent" />

      <div className="panel">
        <h2><span>Waiting for you</span></h2>
        <table className="tbl">
          <thead><tr><th>Request</th><th>Agent</th><th>What it changes</th><th>Impact</th><th></th></tr></thead>
          <tbody>
            {pending.length === 0 && (
              <tr><td colSpan={5} className="muted">{s.phase === 'idle' ? <>No exception approvals. <Link href="/exceptions">Run the flooding scenario</Link> to generate one.</> : 'No exception approvals pending.'} <Live /></td></tr>
            )}
            {pending.map((a) => (
              <tr key={a.id} className="hl">
                <td><b>Plan {a.id}</b><div className="muted small">{a.run === 'replan' ? 'Replan after driver drop-out' : 'Hume Hwy flooding recovery'}</div><Live /></td>
                <td><span className="tag exc">Exception</span></td>
                <td>
                  {a.items.map((i) => {
                    const l = s.loads.find((x) => x.id === i.load_id)!;
                    return (
                      <div key={i.load_id} className="small">
                        <span className="sw" style={{ background: CARGO[l.cargo].color }} />
                        <b>{l.truckId}</b> {ACTION[i.action]}{i.relief_driver_id ? ` · ${i.relief_driver_id}` : ''} · ETA {fmt(i.etaMin)}{' '}
                        <span className={`badge ${i.policy === 'approve' ? 'warn' : 'ok'}`}>{i.policy === 'approve' ? 'needs approval' : 'done automatically'}</span>
                      </div>
                    );
                  })}
                </td>
                <td>Expected late cost <b>{aud(a.items.reduce((n, i) => n + i.expectedCostAud, 0))}</b><div className="muted small">Closure est. {a.closureEstimate.reopenHours}h · {a.closureEstimate.confidence} confidence</div></td>
                <td className="nowrap">
                  <button className="danger" disabled={busy} onClick={() => post('/api/approve', { id: a.id, approve: false })}>Reject</button>{' '}
                  <button className="primary" disabled={busy} onClick={() => post('/api/approve', { id: a.id, approve: true })}>Approve</button>
                  <div><Link href="/exceptions" className="small">Open exception →</Link></div>
                </td>
              </tr>
            ))}
            <tr>
              <td><b>{DISPATCH_PLAN.id}</b><div className="muted small">{DISPATCH_PLAN.title}</div><Mock /></td>
              <td><span className="tag dsp">Dispatch</span></td>
              <td className="small">{DISPATCH_PLAN.rows.length} loads assigned to trucks and drivers, 3 Wodonga relays</td>
              <td className="small">63 freight km per driver-hour (vs 58)<div className="muted">Empty km 9% (vs 14%)</div></td>
              <td><Link href="/dispatch" className="btn">Review plan</Link></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>Decided</h2>
        <table className="tbl">
          <thead><tr><th>Request</th><th>Agent</th><th>Outcome</th><th>Decided by</th></tr></thead>
          <tbody>
            {decided.map((a) => (
              <tr key={a.id}>
                <td><b>Plan {a.id}</b> <Live /></td>
                <td><span className="tag exc">Exception</span></td>
                <td className="small">{a.items.map((i) => `${i.load_id} ETA ${fmt(i.etaMin)}`).join(' · ')}</td>
                <td><span className={`badge ${a.status === 'approved' ? 'ok' : 'alert'}`}>{a.items.some((i) => i.policy === 'approve') ? `${a.status} by dispatcher` : 'auto (policy)'}</span></td>
              </tr>
            ))}
            {HUB_SUGGESTIONS.filter((h) => h.status.startsWith('Auto')).map((h) => (
              <tr key={h.id}>
                <td><b>{h.id}</b> <Mock /></td>
                <td><span className="tag hub">Hub handover</span></td>
                <td className="small">{h.text}</td>
                <td><span className="badge ok">auto (policy)</span></td>
              </tr>
            ))}
            <tr>
              <td><b>DP-0417</b> <Mock /></td>
              <td><span className="tag dsp">Dispatch</span></td>
              <td className="small">Tonight&apos;s plan (Fri 16 Oct), 2 edits by dispatcher</td>
              <td><span className="badge ok">approved by dispatcher</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
