import { SENSOR_TYPES } from '../constants/sensorTypes.js';

const SENSOR_SET = new Set(SENSOR_TYPES);

/**
 * Validate POST /api/readings body. Returns { ok: true, value } or { ok: false, errors: string[] }.
 * @param {unknown} body
 */
export function validateReadingPayload(body) {
  const errors = [];

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, errors: ['Body must be a JSON object.'] };
  }

  const deviceId = body.deviceId;
  if (typeof deviceId !== 'string' || !deviceId.trim()) {
    errors.push('deviceId is required (string).');
  }

  const sensorType = body.sensorType;
  if (typeof sensorType !== 'string' || !SENSOR_SET.has(sensorType)) {
    errors.push(
      `sensorType must be one of: ${SENSOR_TYPES.join(', ')}.`,
    );
  }

  const data = body.data;
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    errors.push('data must be an object.');
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  /** @type {{ temperature?: number; humidity?: number; soilMoisture?: number; distanceCm?: number; irDetected?: boolean }} */
  const d = data;

  switch (sensorType) {
    case 'dht11': {
      if (!Number.isFinite(Number(d.temperature))) {
        errors.push('data.temperature must be a finite number.');
      }
      if (!Number.isFinite(Number(d.humidity))) {
        errors.push('data.humidity must be a finite number.');
      }
      break;
    }
    case 'soil_moisture': {
      if (!Number.isFinite(Number(d.soilMoisture))) {
        errors.push('data.soilMoisture must be a finite number.');
      }
      break;
    }
    case 'ultrasonic': {
      if (!Number.isFinite(Number(d.distanceCm))) {
        errors.push('data.distanceCm must be a finite number.');
      }
      break;
    }
    case 'ir_sensor': {
      if (typeof d.irDetected !== 'boolean') {
        errors.push('data.irDetected must be a boolean.');
      }
      break;
    }
    case 'lm35': {
      if (!Number.isFinite(Number(d.temperature))) {
        errors.push('data.temperature must be a finite number.');
      }
      break;
    }
    default:
      errors.push('Unsupported sensorType.');
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  /** Normalized numeric fields as numbers / boolean */
  const normalizedData = { ...d };
  switch (sensorType) {
    case 'dht11':
      normalizedData.temperature = Number(d.temperature);
      normalizedData.humidity = Number(d.humidity);
      break;
    case 'soil_moisture':
      normalizedData.soilMoisture = Number(d.soilMoisture);
      break;
    case 'ultrasonic':
      normalizedData.distanceCm = Number(d.distanceCm);
      break;
    case 'lm35':
      normalizedData.temperature = Number(d.temperature);
      break;
    case 'ir_sensor':
      normalizedData.irDetected = Boolean(d.irDetected);
      break;
    default:
      break;
  }

  return {
    ok: true,
    value: {
      deviceId: String(deviceId).trim(),
      sensorType,
      data: normalizedData,
    },
  };
}
