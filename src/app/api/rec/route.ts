import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';

/** Тимчасовий приймач запису canvas-анімації (дев-онлі): POST сирим блобом. */
export async function POST(req: Request) {
  try {
    const name = (new URL(req.url).searchParams.get('name') || 'rec.webm').replace(/[^a-z0-9.-]/gi, '');
    const buf = Buffer.from(await req.arrayBuffer());
    const dest = '/tmp/' + name;
    await writeFile(dest, buf);
    return NextResponse.json({ ok: true, dest, kb: Math.round(buf.length / 1024) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
