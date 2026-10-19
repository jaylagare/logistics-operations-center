'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { CARRIER } from '@/src/demo/mock';
import { fmt } from './format';
import { useSim } from './SimProvider';

type Item = { href: string; label: string; icon: string; agent?: boolean; badge?: number; tone?: 'alert' | 'warn' };

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { s, now } = useSim();
  const pending = s?.approvals.filter((a) => a.status === 'pending').length ?? 0;
  const activeExc = s && ['running', 'awaiting_approval', 'replanning'].includes(s.phase) ? 1 : 0;

  const groups: [string, Item[]][] = [
    ['Operate', [
      { href: '/', label: 'Control tower', icon: '◎' },
      { href: '/exceptions', label: 'Exceptions', icon: '⚠', agent: true, badge: activeExc, tone: 'alert' },
      { href: '/approvals', label: 'Approvals', icon: '✓', badge: pending + 1, tone: 'warn' },
    ]],
    ['Plan', [
      { href: '/dispatch', label: 'Dispatch plan', icon: '▤', agent: true },
      { href: '/hubs', label: 'Hub handover', icon: '⇄', agent: true },
    ]],
    ['Fleet', [
      { href: '/loads', label: 'Loads', icon: '▦' },
      { href: '/fleet', label: 'Trucks & drivers', icon: '⛟' },
    ]],
    ['Govern', [
      { href: '/log', label: 'Decision log', icon: '≡' },
      { href: '/policies', label: 'Policies', icon: '⚖' },
    ]],
  ];

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <div className="logo">H</div>
          <div><b>Hybrid Ops Center</b><div className="muted small">{CARRIER.name} · {CARRIER.tag}</div></div>
        </div>
        {groups.map(([g, items]) => (
          <div key={g} className="navgroup">
            <div className="navlabel">{g}</div>
            {items.map((it) => {
              const on = it.href === '/' ? path === '/' : path.startsWith(it.href);
              return (
                <Link key={it.href} href={it.href} className={`nav ${on ? 'on' : ''}`}>
                  <span className="ico">{it.icon}</span>
                  <span className="grow">{it.label}</span>
                  {it.agent && <span className="ai">AI</span>}
                  {!!it.badge && <span className={`count ${it.tone ?? ''}`}>{it.badge}</span>}
                </Link>
              );
            })}
          </div>
        ))}
        <div className="sidefoot">
          <div><span className="dot live" /> Exceptions: live POC</div>
          <div><span className="dot" /> Other screens: mock-up</div>
        </div>
      </aside>
      <div className="body">
        <header className="topbar">
          <div className="muted">{CARRIER.shift} · Melbourne ⇄ Sydney corridor</div>
          <div className="controls">
            {s && (
              <span className={`badge ${s.mode === 'live' ? 'ok' : ''}`} title={s.mode === 'replay' ? 'Agent turns replayed from data/replay.json; tools, policy and ETAs run live' : 'Agent calls Claude live'}>
                Agent: {s.mode === 'live' ? `live · ${s.model}` : 'replay mode'}
              </span>
            )}
            <span className="clock" title="Simulation clock">{fmt(now)}</span>
            <span className="user"><span className="avatar">ND</span>{CARRIER.user}</span>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

export function PageHead({ title, sub, right, live }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; live?: boolean }) {
  return (
    <div className="pagehead">
      <div>
        <h1>{title} {live === false && <span className="badge mock">Mock-up</span>}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {right && <div className="controls">{right}</div>}
    </div>
  );
}

export const Live = () => <span className="badge livechip" title="Driven by the running POC"><span className="dot live" /> Live from POC</span>;
export const Mock = () => <span className="badge mock" title="Illustrative data">Mock</span>;
