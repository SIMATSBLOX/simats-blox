/**
 * Beginner-friendly labels for Add Sensor + UI (maps to backend sensorType strings).
 * Order matches curriculum / IDE examples (DHT11 → … → IR obstacle).
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
    id: 'lm35',
    sensorType: 'lm35',
    title: 'LM35',
    subtitle: 'Analog temperature',
  },
  {
    id: 'mq2',
    sensorType: 'mq2',
    title: 'MQ-2',
    subtitle: 'Gas / smoke (analog)',
  },
  {
    id: 'pir',
    sensorType: 'pir',
    title: 'PIR HC-SR501',
    subtitle: 'Motion (digital)',
  },
  {
    id: 'ldr',
    sensorType: 'ldr',
    title: 'LDR',
    subtitle: 'Light (photoresistor)',
  },
  {
    id: 'ultrasonic',
    sensorType: 'ultrasonic',
    title: 'HC-SR04',
    subtitle: 'Ultrasonic distance',
  },
  {
    id: 'bmp280',
    sensorType: 'bmp280',
    title: 'BMP280',
    subtitle: 'Temperature & pressure (I²C)',
  },
  {
    id: 'soil_moisture',
    sensorType: 'soil_moisture',
    title: 'Soil moisture',
    subtitle: 'Analog soil sensor',
  },
  {
    id: 'rain_sensor',
    sensorType: 'rain_sensor',
    title: 'Rain sensor',
    subtitle: 'Rain / water level (analog)',
  },
  {
    id: 'ir_sensor',
    sensorType: 'ir_sensor',
    title: 'IR obstacle',
    subtitle: 'Obstacle / line (digital)',
  },
  {
    id: 'servo',
    sensorType: 'servo',
    title: 'Servo',
    subtitle: 'Angle telemetry',
  },
];

/** @param {string} sensorType */
export function getSensorPresetByType(sensorType) {
  return SENSOR_ADD_PRESETS.find((p) => p.sensorType === sensorType) ?? null;
}

/** Built-in API type for hardware not in the preset list (flat `data` object in POST /api/readings). */
export const CUSTOM_SENSOR_TYPE = 'custom';

/** Default dashboard name when registration omits `name` (see `deviceController` on the API). */
export const DEFAULT_REGISTERED_DEVICE_NAME = 'Training kit';

/**
 * True for empty name or the server default — UI should show sensor type instead of this placeholder.
 * @param {string | undefined | null} name
 */
export function isPlaceholderSensorDisplayName(name) {
  const t = String(name ?? '').trim();
  return !t || t.toLowerCase() === DEFAULT_REGISTERED_DEVICE_NAME.toLowerCase();
}

/** @param {string} sensorType */
export function friendlySensorTypeLabel(sensorType) {
  if (sensorType === CUSTOM_SENSOR_TYPE) return 'Custom sensor';
  return getSensorPresetByType(sensorType)?.title ?? sensorType;
}

/**
 * Compact device id for dropdowns (keeps prefix, trims long UUIDs).
 * @param {string | undefined | null} deviceId
 */
export function shortSensorDeviceIdForLabel(deviceId) {
  const id = String(deviceId ?? '').trim();
  if (!id) return '—';
  if (id.length <= 24) return id;
  if (id.startsWith('sensor-')) {
    return `${id.slice(0, 16)}…${id.slice(-6)}`;
  }
  return `${id.slice(0, 14)}…${id.slice(-6)}`;
}

/**
 * Primary line for lists: custom name if set (non-placeholder), else friendly sensor type.
 * @param {{ deviceId?: string, name?: string|null, sensorType?: string }} device
 */
export function sensorPrimaryLabel(device) {
  const type = String(device?.sensorType ?? '').trim();
  if (isPlaceholderSensorDisplayName(device?.name)) {
    return friendlySensorTypeLabel(type);
  }
  return String(device?.name ?? '').trim();
}

/**
 * Secondary line: shortened id when showing type as primary; friendly type when showing custom name.
 * @param {{ deviceId?: string, name?: string|null, sensorType?: string }} device
 */
export function sensorSecondaryLabel(device) {
  const type = String(device?.sensorType ?? '').trim();
  const id = String(device?.deviceId ?? '').trim();
  if (isPlaceholderSensorDisplayName(device?.name)) {
    return shortSensorDeviceIdForLabel(id);
  }
  const typeLine = friendlySensorTypeLabel(type);
  if (typeLine && type) return typeLine;
  return shortSensorDeviceIdForLabel(id);
}

/**
 * Single line for native `<select>` options: "Primary — secondary".
 * @param {{ deviceId?: string, name?: string|null, sensorType?: string }} device
 */
export function formatSensorSelectOptionLabel(device) {
  const primary = sensorPrimaryLabel(device);
  const secondary = sensorSecondaryLabel(device);
  if (!secondary || secondary === '—') return primary;
  return `${primary} — ${secondary}`;
}

/**
 * Tooltip / `title`: full id and API type (and raw name if custom).
 * @param {{ deviceId?: string, name?: string|null, sensorType?: string }} device
 */
export function formatSensorDeviceDetailTitle(device) {
  const id = String(device?.deviceId ?? '').trim();
  const type = String(device?.sensorType ?? '').trim();
  const rawName = String(device?.name ?? '').trim();
  const parts = [];
  if (id) parts.push(id);
  if (type) parts.push(type);
  if (rawName && !isPlaceholderSensorDisplayName(rawName)) parts.push(rawName);
  return parts.join(' · ') || 'Sensor';
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
