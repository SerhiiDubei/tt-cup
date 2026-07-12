import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { PALETTE, SHAPES, STYLES } from '@/config';

export const dynamic = 'force-dynamic';
const NAME_MAX = 60, NICK_MAX = 30;

export async function POST(req: NextRequest) {
  let body: { name?: string; style?: string; gender?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const name = (body.name ?? '').trim();
  const nickname = name.replace(/\s+/g, '_').slice(0, NICK_MAX); // нормалізація як у register
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });
  if (name.length > NAME_MAX) return NextResponse.json({ error: 'name_too_long' }, { status: 400 });
  const style = STYLES.includes(body.style as never) ? (body.style as string) : 'allrounder';
  const gender = body.gender === 'male' || body.gender === 'female' ? body.gender : undefined;
  // герой-заглушка: колір з палітри за довжиною імені, без art (з'явиться фоново)
  const hero = { color: PALETTE[name.length % PALETTE.length], shape: SHAPES[0], style, emblem: '', art: '', ...(gender ? { gender } : {}) };

  const { data, error } = await supaServer().from('tt_players')
    .insert({ name, nickname, hero, seed: 0, casual: true })
    .select('id').single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'nick_taken' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data!.id }); // токен НЕ повертаємо (спека §6)
}
