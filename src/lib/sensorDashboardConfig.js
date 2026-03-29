/**
 * Sensor-wise UI: which metrics exist per device type (dashboard + device detail).
 * Keep in sync with backend validateReadingPayload + sensor_types in SQLite.
 */

/** @typedef {{ key: string; label: string; unit?: string; kind?: 'number' | 'boolean' }} SensorFieldDef */

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
 * @param {string} sensorType
 * @param {Record<string, unknown>} data
 * @param {string} key
 */
export function formatSensorValue(sensorType, data, key) {
  const fields = getFieldsForSensorType(sensorType);
  const def = fields.find((f) => f.key === key);
  const v = data?.[key];
  if (def?.kind === 'boolean') {
    return v ? 'Detected' : 'Clear';
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const u = def?.unit ? ` ${def.unit}` : '';
    return `${v}${u}`;
  }
  return v === undefined || v === null ? '—' : String(v);
}
