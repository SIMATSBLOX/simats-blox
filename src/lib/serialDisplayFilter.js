/**
 * Drop MicroPython / Web Serial REPL protocol lines so the Serial Monitor shows
 * mostly board/runtime output (prints, tracebacks). Not perfect for ambiguous chunks.
 * @param {string} line trimmed or raw single logical line (no embedded \n)
 */
export function isSerialProtocolNoiseLine(line) {
  const s = String(line).replace(/\r$/, '').trimEnd();
  if (s.length === 0) return true;
  if (s === '>' || s === '>>>') return true;
  if (/^>{1,3}\s*$/.test(s)) return true;
  if (/^raw REPL/i.test(s)) return true;
  if (/^exec\(open\('main\.py'\)/.test(s)) return true;
  if (/^exec\(compile\(open\('main\.py'\)/.test(s)) return true;
  if (s.startsWith('OK') && (s.includes('^D') || s.includes('\x04'))) return true;
  if (/^MicroPython v[\d.]+\s+on\b/i.test(s)) return true;
  if (/^Type "help\(\)" for more information/.test(s)) return true;
  if (/^__MPYLEN__\s+\d+\s*$/.test(s)) return true;
  if (/^__MPYWROTE__\s+\d+\s*$/.test(s)) return true;
  // Raw REPL merges MicroPython stdout with the success prefix, e.g. "OK __MPYWROTE__ 307"
  if (/^OK\s+__MPYWROTE__\s+\d+\s*$/.test(s)) return true;
  if (/^__MPYHASH__\s+[0-9a-f]+\s*$/i.test(s)) return true;
  if (s.includes('__RBFRM__')) return true;
  if (s.includes('__MPYREADB64__') || s.includes('@@END@@')) return true;
  // Friendly REPL echoes the verify one-liner (quotes vary).
  if (/print\s*\(\s*['"]__RBFRM__/.test(s) || /print\s*\(\s*['"]__MPYREADB64__/.test(s)) return true;
  if (/^import ubinascii;__b=open\('main\.py','rb'\)\.read/i.test(s)) return true;
  if (/^import hashlib;print\('__MPYHASH__'/i.test(s)) return true;
  if (/^OK\s*$/.test(s)) return true;
  if (s === '[Serial: non-text / boot noise omitted]') return true;
  // Collapsed / expanded REPL control noise (long ^X / ^L runs) — not board print output.
  const carets = (s.match(/\^/g) || []).length;
  if (carets >= 6 && s.length >= 48) return true;
  return false;
}

/**
 * Remove protocol-only lines from a serial chunk. Preserves partial final line without \n.
 * @param {string} chunk
 * @returns {string | null} null = append nothing
 */
export function filterSerialMonitorOutput(chunk) {
  if (chunk == null || chunk === '') return null;
  const norm = String(chunk).replace(/\r\n/g, '\n');
  const endsWithNl = norm.endsWith('\n');
  const parts = norm.split('\n');
  const kept = [];
  for (let i = 0; i < parts.length; i++) {
    const line = parts[i];
    const isLast = i === parts.length - 1;
    if (!isLast) {
      if (!isSerialProtocolNoiseLine(line)) kept.push(line);
      continue;
    }
    if (endsWithNl) {
      if (!isSerialProtocolNoiseLine(line)) kept.push(line);
    } else if (line.length > 0 && !isSerialProtocolNoiseLine(line)) {
      kept.push(line);
    }
  }
  if (kept.length === 0) return null;
  const body = kept.join('\n');
  if (endsWithNl) return `${body}\n`;
  return body;
}
