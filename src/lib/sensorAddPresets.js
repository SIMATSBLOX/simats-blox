/**
 * Beginner-friendly labels for Add Sensor + UI (maps to backend sensorType strings).
 */

/** @type {{ id: string; title: string; subtitle: string; sensorType: string }[]} */
export const SENSOR_ADD_PRESETS = [
  {
    id: 'dht11',
    sensorType: 'dht11',
    title: 'DHT11',
    subtitle: 'Temperature & humidity',
  },
  {
    id: 'soil_moisture',
    sensorType: 'soil_moisture',
    title: 'Soil moisture',
    subtitle: 'Analog soil / moisture sensor',
  },
  {
    id: 'ultrasonic',
    sensorType: 'ultrasonic',
    title: 'Ultrasonic',
    subtitle: 'Distance (e.g. HC-SR04)',
  },
  {
    id: 'ir_sensor',
    sensorType: 'ir_sensor',
    title: 'IR sensor',
    subtitle: 'Line or obstacle detection',
  },
  {
    id: 'lm35',
    sensorType: 'lm35',
    title: 'LM35',
    subtitle: 'Temperature (analog)',
  },
];

/** @param {string} sensorType */
export function getSensorPresetByType(sensorType) {
  return SENSOR_ADD_PRESETS.find((p) => p.sensorType === sensorType) ?? null;
}

/** @param {string} sensorType */
export function friendlySensorTypeLabel(sensorType) {
  return getSensorPresetByType(sensorType)?.title ?? sensorType;
}

/**
 * Server requires a deviceId — generate one so learners never type it.
 * @returns {string}
 */
export function generateSensorDeviceId() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return `sensor-${globalThis.crypto.randomUUID()}`;
  }
  return `sensor-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
