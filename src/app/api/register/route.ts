import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { loadState } from '@/lib/state';
import { PALETTE, SHAPES, STYLES } from '@/config';
import { AVATAR_OPTIONS } from '@/lib/avatar';
import { isValidArtUrl } from '@/lib/art-url';

export const dynamic = 'force-dynamic';

const NAME_MAX = 60;
const NICK_MAX = 30;
const MOTTO_MAX = 140;
const EMBLEM_MAX = 8;
const traitIds = (g: keyof typeof AVATAR_OPTIONS) => AVATAR_OPTIONS[g].map((o) => o.id);

/** Coerce attacker-controlled hero JSON into a known-safe, bounded shape. */
function sanitizeHero(raw: unknown) {
  const h = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pick = (v: unknown, allowed: readonly string[], fallback: string): string =>
    typeof v === 'string' && allowed.includes(v) ? v : fallback;
  const cap = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const art = isValidArtUrl(h.art) ? h.art : '';
  return {
    color: pick(h.color, PALETTE, PALETTE[0]),
    shape: pick(h.shape, SHAPES, SHAPES[0]),
    style: pick(h.style, STYLES, STYLES[0]),
    emblem: cap(h.emblem, EMBLEM_MAX),
    art,
    gender: pick(h.gender, traitIds('gender'), 'female'),
    skin: pick(h.skin, traitIds('skin'), 'light'),
    hair: pick(h.hair, traitIds('hair'), 'short'),
    hairColor: pick(h.hairColor, traitIds('hairColor'), 'pink'),
    outfit: pick(h.outfit, traitIds('outfit'), 'jersey-red'),
    accessory: pick(h.accessory, traitIds('accessory'), 'none'),
  };
}

export async function POST(req: NextRequest) {
  let body: { name?: string; nickname?: string; hero?: unknown; motto?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }

  const name = (body.name ?? '').trim();
  const nickname = (body.nickname ?? '').trim().replace(/\s+/g, '_');
  const motto = (body.motto ?? '').trim();
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });
  if (!nickname) return NextResponse.json({ error: 'nickname_required' }, { status: 400 });
  if (name.length > NAME_MAX) return NextResponse.json({ error: 'name_too_long' }, { status: 400 });
  if (nickname.length > NICK_MAX) return NextResponse.json({ error: 'nickname_too_long' }, { status: 400 });
  if (motto.length > MOTTO_MAX) return NextResponse.json({ error: 'motto_too_long' }, { status: 400 });
  const hero = sanitizeHero(body.hero);

  const { tournament, players } = await loadState();
  if (tournament.status !== 'registration')
    return NextResponse.json({ error: 'registration_closed' }, { status: 409 });
  if (tournament.reg_deadline && Date.parse(tournament.reg_deadline) < Date.now())
    return NextResponse.json({ error: 'deadline_passed' }, { status: 409 });

  const s = supaServer();
  const seed = 1000 + players.length * 137;
  const { data, error } = await s
    .from('tt_players')
    .insert({ name, nickname, hero, motto, seed })
    .select('id, token')
    .single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'nick_taken' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data!.id, token: data!.token });
}
