/**
 * Sensor-wise UI: which metrics exist per device type (dashboard + device detail).
 * Keep in sync with backend validateReadingPayload + sensor_types in SQLite.
 */

/** @typedef {{ key: string; label: string; unit?: string; kind?: 'number' | 'boolean' }} SensorFieldDef */

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** @type {Record<string, { fields: SensorFieldDef[] }>} */
export const SENSOR_UI_BY_TYPE = {
  dht11: {
    fields: [
      { key: 'temperature', label: 'Temperature', unit: '°C', kind: 'number' },
      { key: 'humidity', label: 'Humidity', unit: '%', kind: 'number' },
    ],
  },
  soil_moisture: {
    fields: [{ key: 'soilMoisture', label: 'Soil moisture', unit: 'ADC', kind: 'number' }],
  },
  ultrasonic: {
    fields: [{ key: 'distanceCm', label: 'Distance', unit: 'cm', kind: 'number' }],
  },
  ir_sensor: {
    fields: [{ key: 'irDetected', label: 'IR detected', kind: 'boolean' }],
  },
  lm35: {
    fields: [{ key: 'temperature', label: 'Temperature', unit: '°C', kind: 'number' }],
  },
};

/**
 * @param {string} sensorType
 * @returns {SensorFieldDef[]}
 */
export function getFieldsForSensorType(sensorType) {
  return SENSOR_UI_BY_TYPE[sensorType]?.fields ?? [];
}

/**
 * Static fields per type, or for `custom` the union of keys seen in `readingRows` (sorted).
 * @param {string} sensorType
 * @param {{ data?: object }[]} readingRows
 * @returns {SensorFieldDef[]}
 */
export function getDashboardFieldDefs(sensorType, readingRows) {
  const staticFields = SENSOR_UI_BY_TYPE[sensorType]?.fields;
  if (staticFields?.length) return staticFields;
  if (sensorType !== 'custom') return [];
  const keys = new Set();
  for (const r of readingRows ?? []) {
    const d = r?.data;
    if (isPlainObject(d)) Object.keys(d).forEach((k) => keys.add(k));
  }
  return [...keys].sort().map((key) => ({ key, label: key }));
}

/**
 * Numeric fields for history charts. For `custom`, unions finite numeric keys across readings.
 * @param {string} sensorType
 * @param {{ data?: object }[]} readings
 * @returns {SensorFieldDef[]}
 */
export function getChartNumericFieldDefs(sensorType, readings) {
  const base = (SENSOR_UI_BY_TYPE[sensorType]?.fields ?? []).filter((f) => f.kind !== 'boolean');
  if (base.length) return base;
  if (sensorType !== 'custom' || !readings?.length) return [];
  const keys = new Set();
  for (const r of readings) {
    const d = r?.data;
    if (!isPlainObject(d)) continue;
    for (const k of Object.keys(d)) {
      const v = d[k];
      if (typeof v === 'number' && Number.isFinite(v)) keys.add(k);
    }
  }
  return [...keys].sort().map((key) => ({ key, label: key, kind: 'number' }));
}

/**
 * @param {string} sensorType
 * @param {Record<string, unknown>} data
 * @param {string} key
 */
export function formatSensorValue(sensorType, data, key) {
  const fields = getFieldsForSensorType(sensorType);
  let def = fields.find((f) => f.key === key);
  if (!def && sensorType === 'custom') {
    const v0 = data?.[key];
    if (typeof v0 === 'boolean') def = { key, label: key, kind: 'boolean' };
    else if (typeof v0 === 'number' && Number.isFinite(v0)) def = { key, label: key, kind: 'number' };
    else def = { key, label: key };
  }
  if (!def) return '—';
  const v = data?.[key];
  if (def.kind === 'boolean') {
    return v ? 'Detected' : 'Clear';
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const u = def.unit ? ` ${def.unit}` : '';
    return `${v}${u}`;
  }
  if (typeof v === 'string') return v;
  return v === undefined || v === null ? '—' : String(v);
}
