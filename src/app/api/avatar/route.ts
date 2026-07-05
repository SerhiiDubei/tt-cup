import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { supaServer } from '@/lib/supabase/server';
import { buildAvatarPrompt, buildSelfiePrompt, DEFAULT_TRAITS, type Traits } from '@/lib/avatar';
import { STYLES } from '@/config';

export const dynamic = 'force-dynamic';
// GPT image gen takes ~60-80s — needs Vercel Pro (300s cap). On Hobby (60s) this 504s.
export const maxDuration = 300;

const SELFIE_MAX = 4_000_000; // keep under Vercel's ~4.5MB request-body limit

export async function POST(req: NextRequest) {
  if (!process.env.OPENROUTER_API_KEY)
    return NextResponse.json({ error: 'no_openrouter_key' }, { status: 500 });

  let body: { traits?: Partial<Traits>; selfie?: string; style?: string };
  try { body = await req.json(); } catch { body = {}; }

  // Build the OpenRouter message content: image-to-image when a selfie is provided, else text-to-image.
  const selfie = typeof body.selfie === 'string' ? body.selfie : '';
  const isSelfie = selfie.startsWith('data:image/');
  if (selfie && !isSelfie) return NextResponse.json({ error: 'bad_selfie' }, { status: 400 });
  if (isSelfie && selfie.length > SELFIE_MAX) return NextResponse.json({ error: 'selfie_too_large' }, { status: 413 });

  let content: unknown;
  if (isSelfie) {
    const style = STYLES.includes(body.style as never) ? (body.style as string) : 'allrounder';
    content = [
      { type: 'text', text: buildSelfiePrompt(style) },
      { type: 'image_url', image_url: { url: selfie } },
    ];
  } else {
    const traits: Traits = { ...DEFAULT_TRAITS, ...(body.traits || {}) };
    content = buildAvatarPrompt(traits);
  }

  // 1) generate art via OpenRouter (Gemini image; image-to-image when content has the selfie)
  let orJson: any;
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://tt-cup-blush.vercel.app',
        'X-Title': 'TT-CUP avatar',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [{ role: 'user', content }],
        modalities: ['image', 'text'],
      }),
    });
    orJson = await r.json();
  } catch (e) {
    return NextResponse.json({ error: 'openrouter_failed', detail: String((e as Error).message) }, { status: 502 });
  }
  const dataUrl: string | undefined = orJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!dataUrl) return NextResponse.json({ error: 'no_image', detail: orJson?.error ?? null }, { status: 502 });

  // 2) decode + compress to webp. Keep it large (768) so the card/reveal stay crisp —
  // the model returns ~1024², downscaling hard to 360 was the source of the artifacts.
  const b64 = dataUrl.split(',', 2)[1];
  const webp = await sharp(Buffer.from(b64, 'base64'))
    .resize(768, 768, { fit: 'cover' })
    .webp({ quality: 90 })
    .toBuffer();

  // 3) upload to Supabase Storage (public bucket) + return URL.
  // IMPORTANT: upload as a Blob (binary-safe). Passing a Node Buffer corrupts the
  // bytes on Vercel's runtime (binary gets UTF-8 re-encoded → broken webp).
  const s = supaServer();
  const path = `${randomUUID()}.webp`;
  const blob = new Blob([new Uint8Array(webp)], { type: 'image/webp' });
  const { error: upErr } = await s.storage.from('tt-avatars').upload(path, blob, {
    contentType: 'image/webp', upsert: false,
  });
  if (upErr) return NextResponse.json({ error: 'upload_failed', detail: upErr.message }, { status: 500 });
  const { data: pub } = s.storage.from('tt-avatars').getPublicUrl(path);
  return NextResponse.json({ url: pub.publicUrl, bytes: webp.length });
}
