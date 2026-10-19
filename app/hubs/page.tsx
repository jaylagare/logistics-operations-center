'use client';

import { HUB_SCHEDULE, HUB_SUGGESTIONS, ROSTERED } from '@/src/demo/mock';
import { ACTION, fmt } from '@/components/format';
import { Live, Mock, PageHead } from '@/components/Shell';
import { useSim } from '@/components/SimProvider';

const DUR: Record<string, number> = { swap_driver_olympic: 6.9, swap_driver_hume: 5.2, rest_at_hub_then_hume: 5.2, reroute_olympic: 6.9 };

export default function Hubs() {
  const { s } = useSim();
  if (!s) return <div className="page">Loading…</div>;

  // Live rows: exception-agent actions that happen at Wodonga.
  const live = s.loads
    .filter((l) => l.action && l.action !== 'hold_in_place' && l.etaMin !== null)
    .map((l) => {
      const depart = l.etaMin! - DUR[l.action!] * 60;
      const swap = l.action!.startsWith('swap');
      return {
        sort: depart,
        time: fmt(depart),
        truck: l.truckId,
        what: swap ? `Driver swap ${l.driverId} → ${l.assignedDriverId}, departs via ${l.action === 'swap_driver_olympic' ? 'Olympic Hwy' : 'Hume'}` : `${ACTION[l.action!]} (driver ${l.driverId})`,
        dock: swap ? 'Dock 1' : 'Rest bay',
        status: 'Planned',
      };
    });
  const mock = HUB_SCHEDULE.map((h) => {
    const [hh, mm] = h.time.split(':').map(Number);
    const m = hh * 60 + mm;
    return { ...h, sort: m < 12 * 60 ? m + 1440 : m };
  });
  const rows = [...live.map((r) => ({ ...r, live: true, source: 'Exception agent' })), ...mock.map((r) => ({ ...r, live: false }))].sort((a, b) => a.sort - b.sort);

  const relief = s.drivers.filter((d) => d.id.startsWith('D-W') || d.id === 'D-M3');

  return (
    <div className="page">
      <PageHead title="Hub handover · Wodonga" sub="Driver swaps, rest breaks and dock slots at the corridor midpoint" />
      <div className="mocknote">The Hub handover agent is a mock-up. Rows marked <Live /> come from the exception agent&apos;s live plan.</div>

      <div className="grid2 wide">
        <div className="panel">
          <h2>Tonight at Wodonga</h2>
          <table className="tbl">
            <thead><tr><th>Time</th><th>Truck</th><th>What</th><th>Where</th><th>Source</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={r.live ? 'hl' : ''}>
                  <td className="mono">{r.time}</td>
                  <td><b>{r.truck}</b></td>
                  <td className="small">{r.what}</td>
                  <td className="small">{r.dock}</td>
                  <td>{r.live ? <><span className="tag exc">Exception</span> <Live /></> : <span className="small muted">{r.source}</span>}</td>
                </tr>
              ))}
              {live.length === 0 && <tr><td colSpan={5} className="muted small">Exception-agent swaps appear here once a recovery plan is executed.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="col">
          <div className="panel">
            <h2><span>Relief and relay drivers</span><Live /></h2>
            {relief.map((d) => {
              const on = s.loads.find((l) => l.assignedDriverId === d.id);
              return (
                <div key={d.id} className="drv">
                  <div><b>{d.id}</b> {d.name}<div className="muted small">{d.hub === 'MEL' ? 'Based in Melbourne, 3.5h away' : 'Wodonga hub'}</div></div>
                  <span className={`badge ${d.available ? 'ok' : on ? '' : 'alert'}`}>{d.available ? 'Spare' : on ? `Assigned: ${on.truckId}` : 'Unavailable (sick)'}</span>
                </div>
              );
            })}
            {ROSTERED.map((d) => (
              <div key={d.id} className="drv">
                <div><b>{d.id}</b> {d.name}<div className="muted small">{d.status}</div></div>
                <span className="badge">Rostered <Mock /></span>
              </div>
            ))}
          </div>
          <div className="panel">
            <h2><span>Hub handover agent</span><Mock /></h2>
            {HUB_SUGGESTIONS.map((h) => (
              <div key={h.id} className="sugg"><b>{h.id}</b> {h.text}<div className="muted small">{h.status}</div></div>
            ))}
          </div>
          <div className="panel">
            <h2><span>Docks</span><Mock /></h2>
            <div className="docks">
              {['Dock 1', 'Dock 2', 'Dock 3', 'Bay 4', 'Bay 5', 'Bay 6'].map((d, i) => (
                <div key={d} className={`dock ${i === 0 && live.length ? 'busy' : i === 3 ? 'busy' : ''}`}>
                  <b>{d}</b><div className="small">{i === 0 && live.length ? 'Exception swaps' : i === 3 ? 'T-35 rest' : i === 1 ? 'T-41 at 02:30' : i === 2 ? 'T-44 at 04:10' : 'Free'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
