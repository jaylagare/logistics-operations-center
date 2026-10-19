import { NextResponse } from 'next/server';
import { decide } from '@/src/scenarios/runner';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const { id, approve } = await req.json();
  void decide(id, Boolean(approve)); // runs in the background; the UI polls /api/state
  return NextResponse.json({ ok: true });
}
