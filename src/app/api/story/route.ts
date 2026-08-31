import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';

/** Пісочниця історії: фіксація вибору кроку. Локально пише у STORYBOARD;
 *  на Vercel — read-only, фронт покаже фолбек «скажи Клоду вибір словами». */
const DEST = '/Users/serhiidubei/STORYBOARD/projects/pingpong/story_choices.json';

export async function GET() {
  try {
    const raw = await readFile(DEST, 'utf8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ choices: {} });
  }
}

export async function POST(req: Request) {
  try {
    const { step, choice, comment } = await req.json();
    let data: { choices: Record<string, { choice: string; comment?: string; at: string }> } = { choices: {} };
    try { data = JSON.parse(await readFile(DEST, 'utf8')); } catch { /* новий файл */ }
    data.choices[String(step)] = { choice, comment, at: new Date().toISOString() };
    await writeFile(DEST, JSON.stringify(data, null, 2), 'utf8');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'read-only' }, { status: 500 });
  }
}
