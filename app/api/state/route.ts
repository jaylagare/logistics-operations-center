import { NextResponse } from 'next/server';
import { store } from '@/src/scenarios/runner';
export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json(store.state());
}
