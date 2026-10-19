'use client';

import { POLICIES } from '@/src/demo/mock';
import { PageHead } from '@/components/Shell';

export default function Policies() {
  return (
    <div className="page">
      <PageHead title="Policies" sub="What agents may do on their own, what needs a person, and what is never allowed" />
      <div className="mocknote">The exception rules below are the ones the POC&apos;s policy gate enforces in code (src/policy/exception-policy.ts). Editing policies is a mock-up.</div>
      <div className="panel">
        <table className="tbl">
          <thead><tr><th>Action</th><th>Rule</th><th>Applies to</th><th>Outcome</th></tr></thead>
          <tbody>
            {POLICIES.map((p) => {
              const o = /^Blocked/.test(p.rule) ? ['alert', 'Blocked'] : /^Auto/.test(p.rule) ? ['ok', 'Auto'] : /approval|approve|sign-off/i.test(p.rule) && !/^Auto/.test(p.rule) ? ['warn', 'Needs approval'] : ['', 'Person sends'];
              return (
                <tr key={p.action}>
                  <td><b>{p.action}</b></td>
                  <td className="small">{p.rule}</td>
                  <td className="small">{p.agent}</td>
                  <td><span className={`badge ${o[0]}`}>{o[1]}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h2>Why the gate is code, not the model</h2>
        <ul className="list">
          <li>The agent proposes; deterministic rules decide whether it executes. A prompt change cannot widen what runs automatically.</li>
          <li>Every rule is testable and versioned like any other code.</li>
          <li>Each decision log entry records which rule applied.</li>
        </ul>
      </div>
    </div>
  );
}
