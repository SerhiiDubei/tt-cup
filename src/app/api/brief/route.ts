import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';

/** Локальний прийом відповідей брифа (D-onb): пише markdown прямо в проєкт
 *  STORYBOARD. На Vercel файлова система read-only — там кнопка «Зберегти»
 *  поверне підказку скачати .md замість запису. */
const DEST = '/Users/serhiidubei/STORYBOARD/projects/pingpong/BRIEF_ANSWERS.md';

export async function POST(req: Request) {
  try {
    const { md } = await req.json();
    if (typeof md !== 'string' || md.length < 10) {
      return NextResponse.json({ ok: false, error: 'порожньо' }, { status: 400 });
    }
    await writeFile(DEST, md, 'utf8');
    return NextResponse.json({ ok: true, dest: DEST });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Запис недоступний (прод?) — скачай .md кнопкою поруч' },
      { status: 500 },
    );
  }
}
