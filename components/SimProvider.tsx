'use client';

import { createContext, useCallback, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { SimState } from '@/src/core/domain';
import { START, T_END } from './format';

interface Ctx {
  s: SimState | null;
  busy: boolean;
  post: (url: string, body: object) => Promise<void>;
  playT: number | null;
  setPlayT: Dispatch<SetStateAction<number | null>>;
  playing: boolean;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  /** Clock shown everywhere: playback time if the night is being replayed, else the sim clock. */
  now: number;
}

const SimCtx = createContext<Ctx | null>(null);

/** Polls the POC state once for the whole app, so every screen reflects the live exception scenario. */
export function SimProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<SimState | null>(null);
  const [busy, setBusy] = useState(false);
  const [playT, setPlayT] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/state', { cache: 'no-store' });
      setS(await r.json());
    } catch { /* server restarting; keep last state */ }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 700);
    return () => clearInterval(t);
  }, [load]);

  // A fresh run or reset clears any playback.
  useEffect(() => {
    if (s && s.phase !== 'done' && playT !== null) { setPlaying(false); setPlayT(null); }
  }, [s, playT]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (n: number) => {
      const dt = (n - last) / 1000;
      last = n;
      setPlayT((p) => {
        const v = Math.min(T_END, (p ?? START) + dt * 50); // 50 sim-minutes per second
        if (v >= T_END) setPlaying(false);
        return v;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const post = useCallback(async (url: string, body: object) => {
    setBusy(true);
    await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    await load();
    setBusy(false);
  }, [load]);

  const now = playT ?? s?.clockMin ?? START;
  return <SimCtx.Provider value={{ s, busy, post, playT, setPlayT, playing, setPlaying, now }}>{children}</SimCtx.Provider>;
}

export function useSim() {
  const c = useContext(SimCtx);
  if (!c) throw new Error('useSim outside SimProvider');
  return c;
}
