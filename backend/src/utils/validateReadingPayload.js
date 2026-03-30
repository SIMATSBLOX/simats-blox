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
    case 'custom': {
      const keys = Object.keys(d);
      if (keys.length === 0) {
        errors.push('data must include at least one field for custom sensors.');
        break;
      }
      if (keys.length > 32) {
        errors.push('data has too many top-level fields (max 32).');
        break;
      }
      for (const k of keys) {
        const key = String(k).trim();
        if (!key) {
          errors.push('data keys cannot be empty.');
          break;
        }
        if (key.length > 64) {
          errors.push(`data key is too long (max 64 characters).`);
          break;
        }
        const v = d[k];
        if (typeof v === 'number') {
          if (!Number.isFinite(v)) errors.push(`data.${key} must be a finite number.`);
        } else if (typeof v === 'boolean') {
          /* ok */
        } else if (typeof v === 'string') {
          if (v.length > 512) errors.push(`data.${key} string is too long (max 512).`);
        } else {
          errors.push(
            `data.${key} must be a number, string, or boolean (not objects, arrays, or null).`,
          );
        }
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
  let normalizedData = { ...d };
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
    case 'custom': {
      const out = {};
      for (const k of Object.keys(d)) {
        const key = String(k).trim();
        const v = d[k];
        if (typeof v === 'number' && Number.isFinite(v)) out[key] = Number(v);
        else if (typeof v === 'boolean') out[key] = Boolean(v);
        else if (typeof v === 'string') out[key] = String(v).slice(0, 512);
      }
      normalizedData = out;
      break;
    }
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
