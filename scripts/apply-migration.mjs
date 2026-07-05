// One-off migration runner. Usage:
//   PG_URL="postgresql://...":  node scripts/apply-migration.mjs <sqlFile>
import { readFileSync } from 'node:fs';
import pg from 'pg';

const url = process.env.PG_URL;
const file = process.argv[2];
if (!url || !file) { console.error('need PG_URL env + sql file arg'); process.exit(1); }

const sql = readFileSync(file, 'utf8');
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

const run = async () => {
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema='public' and table_name like 'tt_%' order by table_name"
  );
  console.log('OK — tt_ tables:', rows.map(r => r.table_name).join(', '));
  await client.end();
};
run().catch(e => { console.error('MIGRATION ERROR:', e.message); process.exit(1); });
