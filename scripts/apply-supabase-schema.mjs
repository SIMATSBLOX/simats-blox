import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '../backend/supabase_schema.sql');
const supabaseDbUrl = process.env.SUPABASE_DB_URL;

if (!supabaseDbUrl) {
  throw new Error('SUPABASE_DB_URL is required to apply Supabase schema migrations.');
}

async function applySchema() {
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const client = new Client({ connectionString: supabaseDbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    console.log('[db:migrate] Applying Supabase schema from', schemaPath);
    await client.query(sql);
    console.log('[db:migrate] Schema applied successfully.');
  } finally {
    await client.end();
  }
}

applySchema().catch((error) => {
  console.error('[db:migrate] Failed to apply schema:', error?.message || error);
  process.exit(1);
});
