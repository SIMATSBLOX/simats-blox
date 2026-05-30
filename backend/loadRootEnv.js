import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(backendDir, '../.env');

function unquote(value) {
  const trimmed = value.trim();
  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function loadRootEnv(envPath = rootEnvPath) {
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const withoutExport = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const equalsIndex = withoutExport.indexOf('=');
    if (equalsIndex <= 0) continue;

    const key = withoutExport.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;

    process.env[key] = unquote(withoutExport.slice(equalsIndex + 1));
  }
}

loadRootEnv();
