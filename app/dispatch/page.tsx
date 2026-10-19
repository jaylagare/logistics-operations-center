'use client';

import { DISPATCH_PLAN as P } from '@/src/demo/mock';
import { CARGO } from '@/components/format';
import { PageHead } from '@/components/Shell';

export default function Dispatch() {
  return (
    <div className="page">
      <PageHead
        live={false}
        title={<>Dispatch plan · {P.title}</>}
        sub={<>Drafted by the <b>Dispatch agent</b> at {P.createdAt} · {P.id} · {P.status}</>}
        right={<><button disabled title="Mock-up">Edit</button><button className="primary" disabled title="Mock-up">Approve plan</button></>}
      />
      <div className="mocknote">Mock-up of the Phase 1 Dispatch agent. Illustrative data; not part of the POC.</div>

      <div className="kpis">
        {P.stats.map((x) => (
          <div key={x.k} className="kpi"><div className="k">{x.k}</div><div className="v">{x.v}</div><div className="d">{x.d ?? ' '}</div></div>
        ))}
      </div>

      <div className="panel">
        <h2>Proposed assignments</h2>
        <table className="tbl">
          <thead><tr><th>Load</th><th>Lane</th><th>Cargo</th><th>Truck</th><th>Driver</th><th>Departs</th><th>ETA</th><th>Window</th><th>Checks</th><th>Agent note</th></tr></thead>
          <tbody>
            {P.rows.map((r) => (
              <tr key={r.load}>
                <td className="nowrap"><b>{r.load}</b></td>
                <td className="nowrap">{r.lane}</td>
                <td className="nowrap"><span className="sw" style={{ background: CARGO[r.cargo].color }} />{CARGO[r.cargo].label}</td>
                <td>{r.truck}</td>
                <td>{r.driver}</td>
                <td className="mono">{r.depart}</td>
                <td className="mono">{r.eta}</td>
                <td className="mono">{r.window}</td>
                <td>{r.checks.map((c) => <span key={c} className="check">✓ {c}</span>)}</td>
                <td className="small muted">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid2">
        <div className="panel">
          <h2>Assumptions the plan depends on</h2>
          <ul className="list">{P.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
        <div className="panel">
          <h2>Open questions for the dispatcher</h2>
          <ul className="list">{P.questions.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      </div>
    </div>
  );
}
