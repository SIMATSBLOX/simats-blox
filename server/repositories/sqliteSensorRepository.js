/**
 * SQLite sensor persistence — delegates to `server/sensorStore.js`.
 * Plaintext `api_key` verification. Methods are async for parity with the Supabase repository.
 */
import crypto from 'node:crypto';
import * as sensorStore from '../sensorStore.js';

function timingSafeEqualStrings(a, b) {
  const s1 = String(a ?? '');
  const s2 = String(b ?? '');
  if (s1.length !== s2.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(s1, 'utf8'), Buffer.from(s2, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * @returns {import('./sensorRepositoryContract.js').SensorRepository}
 */
export function createSqliteSensorRepository() {
  return {
    async authenticateDevice(deviceIdTrimmed, apiKeyTrimmed) {
      const row = sensorStore.getSensorDeviceRowByDeviceId(deviceIdTrimmed);
      if (!row) {
        return { ok: false, error: 'device_not_found' };
      }
      if (!timingSafeEqualStrings(row.api_key, apiKeyTrimmed)) {
        return { ok: false, error: 'invalid_key' };
      }
      return {
        ok: true,
        sensorDevice: {
          ownerUserId: row.owner_user_id,
          deviceId: row.device_id,
          sensorType: row.sensor_type,
        },
      };
    },

    async listSensorDevicesForUser(ownerUserId) {
      return sensorStore.listSensorDevicesForUser(ownerUserId);
    },
    async insertSensorDevice(p) {
      return sensorStore.insertSensorDevice(p);
    },
    async getSensorDeviceForUser(ownerUserId, deviceId) {
      return sensorStore.getSensorDeviceForUser(ownerUserId, deviceId);
    },
    async getLatestSensorReading(ownerUserId, deviceId) {
      return sensorStore.getLatestSensorReading(ownerUserId, deviceId);
    },
    async getSensorReadingsHistory(ownerUserId, deviceId, limit) {
      return sensorStore.getSensorReadingsHistory(ownerUserId, deviceId, limit);
    },
    async listSensorReadingsLog(ownerUserId, deviceId, limit) {
      return sensorStore.listSensorReadingsLog(ownerUserId, deviceId, limit);
    },
    async insertSensorReading(p) {
      return sensorStore.insertSensorReading(p);
    },
    async deleteSensorDevice(ownerUserId, deviceId) {
      return sensorStore.deleteSensorDevice(ownerUserId, deviceId);
    },
    async regenerateSensorDeviceApiKey(ownerUserId, deviceIdTrim) {
      return sensorStore.regenerateSensorDeviceApiKey(ownerUserId, deviceIdTrim);
    },
  };
}
