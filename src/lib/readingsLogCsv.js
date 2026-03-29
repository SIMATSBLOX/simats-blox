/**
 * Client-side CSV for Logs & History (current fetched rows, same order as UI).
 */

/** Stable column order for known reading payload keys (matches common sensors). */
export const READINGS_LOG_CSV_VALUE_KEYS = [
  'temperature',
  'humidity',
  'distanceCm',
  'soilMoisture',
  'irDetected',
];

/**
 * @param {unknown} v
 */
function escapeCsvCell(v) {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * @param {object} reading
 * @param {string[]} valueKeys
 */
function rowCells(reading, valueKeys) {
  const data = reading?.data && typeof reading.data === 'object' ? reading.data : {};
  const cells = [
    escapeCsvCell(reading?.createdAt ?? ''),
    escapeCsvCell(reading?.deviceId ?? ''),
    escapeCsvCell(reading?.deviceName ?? ''),
    escapeCsvCell(reading?.deviceStatus ?? ''),
    escapeCsvCell(reading?.sensorType ?? ''),
  ];
  for (const key of valueKeys) {
    const raw = Object.prototype.hasOwnProperty.call(data, key) ? data[key] : '';
    if (raw === null || raw === undefined) {
      cells.push('');
    } else if (typeof raw === 'boolean') {
      cells.push(escapeCsvCell(raw ? 'true' : 'false'));
    } else if (typeof raw === 'number' && Number.isFinite(raw)) {
      cells.push(escapeCsvCell(raw));
    } else {
      cells.push(escapeCsvCell(raw));
    }
  }
  let payloadJson = '';
  try {
    payloadJson = JSON.stringify(data);
  } catch {
    payloadJson = '';
  }
  cells.push(escapeCsvCell(payloadJson));
  return cells.join(',');
}

/**
 * @param {object[]} readings — same shape as API / useReadingsLog
 * @returns {string} CSV text with header (UTF-8; BOM optional — omit for simpler tooling)
 */
export function buildReadingsLogCsv(readings) {
  const list = Array.isArray(readings) ? readings : [];
  const headerNames = [
    'time',
    'device_id',
    'device_name',
    'status',
    'sensor_type',
    ...READINGS_LOG_CSV_VALUE_KEYS.map((k) => `value_${k}`),
    'reading_payload_json',
  ];
  const header = headerNames.join(',');
  const body = list.map((r) => rowCells(r, READINGS_LOG_CSV_VALUE_KEYS)).join('\r\n');
  return body ? `${header}\r\n${body}` : `${header}\r\n`;
}

/**
 * Download CSV in the browser.
 * @param {string} csvText
 * @param {string} filename
 */
export function downloadCsvFile(csvText, filename) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
