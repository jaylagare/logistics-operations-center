'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TRUCKS } from '@/src/demo/mock';
import { CARGO, aud, fmt } from '@/components/format';
import { Live, Mock, PageHead } from '@/components/Shell';
import { useSim } from '@/components/SimProvider';

type Row = { id: string; customer: string; cargo: keyof typeof CARGO | null; lane: string; truck: string; driver: string; window: string; eta: string; status: string; tone: 'ok' | 'bad' | 'warn' | ''; late: string; plan: string; live: boolean };

export default function Loads() {
  const { s } = useSim();
  const [f, setF] = useState<'all' | 'risk' | 'live'>('all');
  if (!s) return <div className="page">Loading…</div>;
  const started = s.phase !== 'idle';

  const live: Row[] = s.loads.map((l) => {
    const late = l.etaMin !== null && l.etaMin > l.windowMin;
    const risk = started && (l.etaMin === null || late);
    return {
      id: l.id, customer: l.customer, cargo: l.cargo, lane: 'MEL → SYD', truck: l.truckId, driver: l.assignedDriverId,
      window: fmt(l.windowMin), eta: started ? fmt(l.etaMin) : '—', status: started ? l.status : 'In transit',
      tone: !started ? '' : late ? 'bad' : risk ? 'bad' : 'ok', late: l.lateCostAud ? aud(l.lateCostAud) : '—', plan: l.plan ?? '—', live: true,
    };
  });
  const mock: Row[] = TRUCKS.filter((t) => t.load).map((t) => ({
    id: t.load!, customer: t.customer, cargo: t.cargo, lane: t.lane, truck: t.truck, driver: t.driver, window: t.window, eta: t.eta,
    status: t.status, tone: t.status.startsWith('Delivered') ? '' : 'ok', late: '—', plan: '—', live: false,
  }));
  let rows = [...live, ...mock];
  if (f === 'risk') rows = rows.filter((r) => r.tone === 'bad');
  if (f === 'live') rows = rows.filter((r) => r.live);

  return (
    <div className="page">
      <PageHead title="Loads" sub="Every load on the network tonight" right={
        <div className="seg">
          {([['all', 'All'], ['risk', 'At risk'], ['live', 'Affected by closure']] as const).map(([k, l]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}
        </div>
      } />
      <div className="panel">
        <table className="tbl">
          <thead><tr><th>Load</th><th>Customer</th><th>Cargo</th><th>Lane</th><th>Truck</th><th>Driver</th><th>Window</th><th>ETA</th><th>Status</th><th>Late cost</th><th>Recovery plan</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.live && started ? 'hl' : ''}>
                <td><b>{r.id}</b></td>
                <td>{r.customer}</td>
                <td className="nowrap">{r.cargo && <span className="sw" style={{ background: CARGO[r.cargo].color }} />}{r.cargo ? CARGO[r.cargo].label : '—'}</td>
                <td className="nowrap">{r.lane}</td>
                <td>{r.truck}</td>
                <td>{r.driver}</td>
                <td className="mono">{r.window}</td>
                <td className="mono">{r.eta}</td>
                <td><span className={`badge ${r.tone === 'bad' ? 'alert' : r.tone === 'ok' ? 'ok' : ''}`}>{r.status}</span></td>
                <td>{r.late}</td>
                <td className="small">{r.live && r.plan !== '—' ? <Link href="/exceptions">{r.plan}</Link> : r.plan}</td>
                <td>{r.live ? <Live /> : <Mock />}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={12} className="muted">No loads match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
