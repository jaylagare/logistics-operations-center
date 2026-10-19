/**
 * State store and event stream.
 *
 * The POC keeps one shift's state in memory (a process-wide singleton, so Next.js API routes and the
 * CLI see the same object). Everything that changes state goes through this module, so a product
 * implementation can swap in a database-backed store with the same API (backlog F-102 event store).
 *
 * Front ends subscribe to events instead of polling internals: the web UI reads snapshots via
 * /api/state, the CLI subscribes to the event stream.
 */
import type { DecisionRecord, FeedEntry, SimState, TraceEntry } from '../core/domain';

export type SimEvent =
  | { type: 'trace'; entry: TraceEntry; data?: unknown } // data = raw tool input/output
  | { type: 'feed'; entry: FeedEntry }
  | { type: 'decision'; entry: DecisionRecord };

export interface Store {
  state(): SimState;
  reset(initial: SimState): SimState;
  nextId(): number;
  feed(level: FeedEntry['level'], text: string, timeMin?: number): void;
  trace(run: string, kind: TraceEntry['kind'], title: string, body?: string, data?: unknown): void;
  decision(text: string): void;
  subscribe(fn: (e: SimEvent) => void): () => void;
}

const g = globalThis as unknown as { __sim?: SimState; __simInit?: () => SimState; __simSubs?: Set<(e: SimEvent) => void> };
const subs = (g.__simSubs ??= new Set());
const emit = (e: SimEvent) => subs.forEach((fn) => fn(e));

/** Register how to build the initial state (normally the default scenario's seed). */
export function configureStore(init: () => SimState) {
  g.__simInit = init;
}

export const store: Store = {
  state() {
    if (!g.__sim) {
      if (!g.__simInit) throw new Error('Store not configured: call configureStore() with a scenario');
      g.__sim = g.__simInit();
    }
    return g.__sim;
  },
  reset(initial) {
    g.__sim = initial;
    return initial;
  },
  nextId() {
    return store.state().seq++;
  },
  feed(level, text, timeMin) {
    const s = store.state();
    const entry: FeedEntry = { id: store.nextId(), timeMin: timeMin ?? s.clockMin, level, text };
    s.feed.push(entry);
    emit({ type: 'feed', entry });
  },
  trace(run, kind, title, body = '', data) {
    const entry: TraceEntry = { id: store.nextId(), run, kind, title, body, at: Date.now() };
    store.state().trace.push(entry);
    emit({ type: 'trace', entry, data });
  },
  decision(text) {
    const s = store.state();
    const entry: DecisionRecord = { id: store.nextId(), timeMin: s.clockMin, text };
    s.decisions.push(entry);
    emit({ type: 'decision', entry });
  },
  subscribe(fn) {
    subs.add(fn);
    return () => { subs.delete(fn); };
  },
};
