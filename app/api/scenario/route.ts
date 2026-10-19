import { NextResponse } from 'next/server';
import { resetScenario, startScenario, store } from '@/src/scenarios/runner';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const { action } = await req.json().catch(() => ({ action: 'start' }));
  if (action === 'reset') {
    resetScenario();
    return NextResponse.json({ ok: true });
  }
  if (store.state().phase !== 'idle') resetScenario();
  void startScenario(); // runs in the background; the UI polls /api/state
  return NextResponse.json({ ok: true });
}
