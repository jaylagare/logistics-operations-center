'use client';

import { TRUCKS } from '@/src/demo/mock';
import { CARGO } from '@/components/format';
import { Live, Mock, PageHead } from '@/components/Shell';
import { useSim } from '@/components/SimProvider';

const Hours = ({ h }: { h: number }) => (
  <div className="hours" title={`${h}h of work time left`}>
    <div className={`fill ${h < 2.5 ? 'bad' : h < 4.5 ? 'warn' : ''}`} style={{ width: `${Math.min(100, (h / 12) * 100)}%` }} />
    <span>{h.toFixed(1)}h</span>
  </div>
);

export default function Fleet() {
  const { s } = useSim();
  if (!s) return <div className="page">Loading…</div>;
  const started = s.phase !== 'idle';

  return (
    <div className="page">
      <PageHead title="Trucks & drivers" sub="Positions, assignments and remaining work hours (simplified fatigue rule: 12h, then 7h rest)" />
      <div className="panel">
        <h2>Trucks on the network</h2>
        <table className="tbl">
          <thead><tr><th>Truck</th><th>Load</th><th>Direction</th><th>Where</th><th>Driver</th><th>Hours left</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {s.loads.map((l) => {
              const d = s.drivers.find((x) => x.id === l.assignedDriverId)!;
              return (
                <tr key={l.id} className={started ? 'hl' : ''}>
                  <td><span className="sw" style={{ background: CARGO[l.cargo].color }} /><b>{l.truckId}</b></td>
                  <td>{l.id}</td>
                  <td>Northbound</td>
                  <td className="small">{l.stoppedAtClosure ? 'At the closure, north of Albury' : l.posFromWodongaH === 0 ? 'Wodonga hub' : l.posFromWodongaH > 0 ? 'Just north of Wodonga' : 'Approaching Wodonga'}</td>
                  <td>{d.id} {d.name}</td>
                  <td><Hours h={d.hoursLeft} /></td>
                  <td><span className={`badge ${!started ? 'ok' : /late|lost|Stopped/.test(l.status) ? 'alert' : 'ok'}`}>{started ? l.status : 'On schedule'}</span></td>
                  <td><Live /></td>
                </tr>
              );
            })}
            {TRUCKS.map((t) => (
              <tr key={t.truck}>
                <td>{t.cargo && <span className="sw" style={{ background: CARGO[t.cargo].color }} />}<b>{t.truck}</b></td>
                <td>{t.load ?? '—'}</td>
                <td>{t.dir}</td>
                <td className="small">{t.where}</td>
                <td>{t.driver === '—' ? '—' : `${t.driver} ${t.driverName}`}</td>
                <td>{t.driver === '—' ? '—' : <Hours h={t.hoursLeft} />}</td>
                <td><span className={`badge ${t.tone === 'ok' ? 'ok' : t.tone === 'warn' ? 'warn' : ''}`}>{t.status}</span></td>
                <td><Mock /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2><span>Relief drivers</span><Live /></h2>
        <table className="tbl">
          <thead><tr><th>Driver</th><th>Base</th><th>Hours left</th><th>Status</th></tr></thead>
          <tbody>
            {s.drivers.filter((d) => d.hub).map((d) => {
              const on = s.loads.find((l) => l.assignedDriverId === d.id);
              return (
                <tr key={d.id}>
                  <td><b>{d.id}</b> {d.name}</td>
                  <td>{d.hub === 'WOD' ? 'Wodonga hub' : `Melbourne (${d.travelToWodongaH}h to Wodonga)`}</td>
                  <td><Hours h={d.hoursLeft} /></td>
                  <td><span className={`badge ${d.available ? 'ok' : on ? '' : 'alert'}`}>{d.available ? 'Spare' : on ? `Assigned to ${on.truckId}` : 'Unavailable (called in sick)'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
