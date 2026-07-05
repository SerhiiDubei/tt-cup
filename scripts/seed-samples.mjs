// Seed ~12 sample players WITH AI art (calls local /api/avatar, inserts into Supabase).
import { createClient } from '@supabase/supabase-js';
const B = 'http://localhost:3000';
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nitlmgcxdcwtbzfwlhug.supabase.co';
const KEY = process.env.SUPABASE_SECRET_KEY;
const s = createClient(URL, KEY, { auth: { persistSession: false } });

const ACCENT = { 'jersey-red': '#FF5A36', 'jersey-cyan': '#00CFC1', 'jersey-purple': '#8A45FF', hoodie: '#2D4BFF', polo: '#FFC619' };
const STYLES = ['attacker', 'defender', 'allrounder', 'spinner'];

const P = [
  ['Олег', 'TOPSPIN_OLEG', { gender: 'male', skin: 'light', hair: 'short', hairColor: 'brown', outfit: 'jersey-red', accessory: 'headband' }, 'ракетка — продовження руки'],
  ['Марія', 'SMASH_M', { gender: 'female', skin: 'light', hair: 'long', hairColor: 'pink', outfit: 'jersey-cyan', accessory: 'none' }, 'подача — це вже атака'],
  ['Іван', 'THE_WALL', { gender: 'male', skin: 'medium', hair: 'buzz', hairColor: 'black', outfit: 'polo', accessory: 'wristband' }, 'через мене не пройдеш'],
  ['Софія', 'SPINZILLA', { gender: 'female', skin: 'tan', hair: 'ponytail', hairColor: 'mint', outfit: 'jersey-purple', accessory: 'glasses' }, 'кручу як хочу'],
  ['Данило', 'LOOP_KING', { gender: 'male', skin: 'medium', hair: 'curly', hairColor: 'blue', outfit: 'hoodie', accessory: 'glasses' }, 'топ-спін до перемоги'],
  ['Аня', 'PIXEL_ANYA', { gender: 'female', skin: 'light', hair: 'bun', hairColor: 'blue', outfit: 'jersey-red', accessory: 'headband' }, 'грай красиво'],
  ['Макс', 'MAXATTACK', { gender: 'male', skin: 'tan', hair: 'short', hairColor: 'blonde', outfit: 'jersey-cyan', accessory: 'cap' }, 'атака — найкращий захист'],
  ['Юля', 'DROP_SHOT', { gender: 'female', skin: 'medium', hair: 'curly', hairColor: 'black', outfit: 'polo', accessory: 'none' }, 'тихо, але влучно'],
  ['Богдан', 'BOOMER', { gender: 'male', skin: 'dark', hair: 'short', hairColor: 'black', outfit: 'jersey-purple', accessory: 'wristband' }, 'бах — і очко'],
  ['Ніка', 'NIKA11', { gender: 'female', skin: 'tan', hair: 'long', hairColor: 'brown', outfit: 'hoodie', accessory: 'cap' }, '11:0 — мій улюблений рахунок'],
  ['Артем', 'SLICE_ART', { gender: 'male', skin: 'light', hair: 'ponytail', hairColor: 'mint', outfit: 'jersey-red', accessory: 'glasses' }, 'різка — це мистецтво'],
  ['Зоя', 'ZONE_OUT', { gender: 'neutral', skin: 'dark', hair: 'buzz', hairColor: 'pink', outfit: 'jersey-cyan', accessory: 'headband' }, 'у потоці'],
];

const run = async () => {
  let i = 0;
  for (const [name, nick, traits, motto] of P) {
    i++;
    process.stdout.write(`(${i}/${P.length}) ${nick} … `);
    let art = '';
    try {
      const r = await fetch(B + '/api/avatar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ traits }) });
      const d = await r.json();
      art = d.url || '';
      if (!art) { console.log('NO ART', d.error || ''); }
    } catch (e) { console.log('avatar err', e.message); }
    const hero = { ...traits, color: ACCENT[traits.outfit] || '#FF2E88', style: STYLES[i % 4], emblem: '★', art };
    const { error } = await s.from('tt_players').insert({ name, nickname: nick, hero, motto, seed: 1000 + i * 137 });
    console.log(error ? 'DB ERR ' + error.message : (art ? 'ok' : 'ok(no art)'));
  }
  const { count } = await s.from('tt_players').select('*', { count: 'exact', head: true });
  console.log('TOTAL players:', count);
};
run().catch((e) => { console.error(e); process.exit(1); });
