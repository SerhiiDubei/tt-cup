import { NextResponse } from 'next/server';
import { loadTableState } from '@/lib/table/state';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadTableState());
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
