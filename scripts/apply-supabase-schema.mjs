import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import '../backend/loadRootEnv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '../backend/supabase_schema.sql');
const supabaseDbUrl = process.env.SUPABASE_DB_URL;

if (!supabaseDbUrl) {
  throw new Error('SUPABASE_DB_URL is required to apply Supabase schema migrations.');
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let singleQuoted = false;
  let doubleQuoted = false;
  let dollarQuoteTag = null;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (!singleQuoted && !doubleQuoted && !dollarQuoteTag && char === '-' && next === '-') {
      const newlineIndex = sql.indexOf('\n', i + 2);
      if (newlineIndex === -1) break;
      i = newlineIndex;
      current += '\n';
      continue;
    }

    if (!singleQuoted && !doubleQuoted && char === '$') {
      const tagMatch = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (tagMatch) {
        const tag = tagMatch[0];
        if (!dollarQuoteTag) {
          dollarQuoteTag = tag;
        } else if (dollarQuoteTag === tag) {
          dollarQuoteTag = null;
        }
        current += tag;
        i += tag.length - 1;
        continue;
      }
    }

    if (!dollarQuoteTag && !doubleQuoted && char === "'" && sql[i - 1] !== '\\') {
      singleQuoted = !singleQuoted;
    } else if (!dollarQuoteTag && !singleQuoted && char === '"') {
      doubleQuoted = !doubleQuoted;
    }

    if (!singleQuoted && !doubleQuoted && !dollarQuoteTag && char === ';') {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = '';
      continue;
    }

    current += char;
  }

  const lastStatement = current.trim();
  if (lastStatement) statements.push(lastStatement);
  return statements;
}

async function applySchema() {
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const statements = splitSqlStatements(sql);
  const client = new Client({ connectionString: supabaseDbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    console.log('[db:migrate] Applying Supabase schema from', schemaPath);
    for (const statement of statements) {
      try {
        await client.query(statement);
      } catch (error) {
        error.message = `${error.message}\nStatement: ${statement.slice(0, 240).replace(/\s+/g, ' ')}`;
        throw error;
      }
    }
    console.log('[db:migrate] Schema applied successfully.');
  } finally {
    await client.end();
  }
}

applySchema().catch((error) => {
  console.error('[db:migrate] Failed to apply schema:', error?.message || error);
  process.exit(1);
});
