'use client';

import { EARLIER_DECISIONS } from '@/src/demo/mock';
import { fmt } from '@/components/format';
import { Live, Mock, PageHead } from '@/components/Shell';
import { useSim } from '@/components/SimProvider';

export default function Log() {
  const { s } = useSim();
  if (!s) return <div className="page">Loading…</div>;
  return (
    <div className="page">
      <PageHead title="Decision log" sub="Every executed action, who decided it, and when. Each exception decision links to the agent's full reasoning trace." />
      <div className="panel">
        <h2><span>Tonight · Fri 16 Oct</span><Live /></h2>
        <div className="feed">
          {s.decisions.length === 0 && <div className="empty">No decisions yet tonight. Run the flooding scenario on the Exceptions screen.</div>}
          {[...s.decisions].reverse().map((d) => (
            <div key={d.id}><span className="t">{fmt(d.timeMin)}</span><span className="tag exc">Exception</span> {d.text}</div>
          ))}
          {s.notifications.map((n) => (
            <div key={`n${n.id}`}><span className="t">{fmt(n.timeMin)}</span><span className="tag exc">Exception</span> Customer message drafted for {n.to} ({n.loadId}) · awaiting send by a person</div>
          ))}
        </div>
      </div>
      <div className="panel">
        <h2><span>Earlier</span><Mock /></h2>
        <div className="feed">
          {EARLIER_DECISIONS.map((d) => <div key={d.when}><span className="t">{d.when}</span>{d.text}</div>)}
        </div>
      </div>
    </div>
  );
}
