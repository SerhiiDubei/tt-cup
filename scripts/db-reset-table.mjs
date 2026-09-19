// Обнулення бази перед запуском продукту (D-054).
// БЕЗПЕКА: перед видаленням завжди робить свіжий бекап у backups/.
// Режими:
//   node scripts/db-reset-table.mjs --dry           показати, що буде знесено
//   node scripts/db-reset-table.mjs --kiosk         знести дані кіоска (tt_*)
//   node scripts/db-reset-table.mjs --kiosk --liga  + тестові реєстрації ліги (dbc_players)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const env = readFileSync('E:/Work Stuff/ttcup-shtab/.env.local', 'utf8');
const BASE = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const KEY = env.match(/SUPABASE_SECRET_KEY=(.+)/)[1].trim();
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' };

const args = process.argv.slice(2);
const dry = args.includes('--dry') || (!args.includes('--kiosk') && !args.includes('--liga'));
const doKiosk = args.includes('--kiosk');
const doLiga = args.includes('--liga');

const get = async (t, q = 'select=*') => (await fetch(`${BASE}/rest/v1/${t}?${q}`, { headers: H })).json();

/** Знести всі рядки таблиці (PostgREST вимагає фільтр — беремо «id не порожній»). */
async function wipe(table, idCol = 'id') {
  const r = await fetch(`${BASE}/rest/v1/${table}?${idCol}=not.is.null`, { method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' } });
  if (!r.ok) throw new Error(`${table}: HTTP ${r.status} ${await r.text()}`);
  console.log(`  ✓ ${table} — очищено`);
}

// 1. Бекап (завжди, навіть у dry)
const TABLES = ['tt_players', 'tt_casual_games', 'tt_table_queue', 'tt_matches', 'tt_tournament', 'dbc_players'];
const dump = {};
for (const t of TABLES) dump[t] = await get(t);
mkdirSync('backups', { recursive: true });
const stamp = dump.tt_casual_games?.[0]?.started_at?.slice(0, 10) ?? 'now';
const file = `backups/db-before-reset-${stamp}.json`;
writeFileSync(file, JSON.stringify(dump, null, 1));
console.log(`💾 бекап: ${file}`);
for (const t of TABLES) console.log(`   ${t}: ${dump[t].length}`);

if (dry) {
  console.log('\n🔍 DRY RUN — нічого не видалено. Буде знесено:');
  console.log(`   кіоск: ${dump.tt_players.length} гравців, ${dump.tt_casual_games.length} партій, ${dump.tt_table_queue.length} у черзі`);
  console.log(`   ліга (--liga): ${dump.dbc_players.length} тестових реєстрацій`);
  process.exit(0);
}

// 2. Видалення (порядок: залежні → батьківські)
if (doKiosk) {
  console.log('\n🧹 Кіоск:');
  await wipe('tt_table_queue');
  await wipe('tt_casual_games');
  await wipe('tt_players');
}
if (doLiga) {
  console.log('\n🧹 Ліга (тестові реєстрації):');
  await wipe('dbc_players');
}

// 3. Контроль
console.log('\n📊 Після очистки:');
for (const t of TABLES) console.log(`   ${t}: ${(await get(t)).length}`);
