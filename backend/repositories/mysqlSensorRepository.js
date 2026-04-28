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
export function createMysqlSensorRepository() {
  return {
    async authenticateDevice(deviceIdTrimmed, apiKeyTrimmed) {
      const row = await sensorStore.getSensorDeviceRowByDeviceIdAsync(deviceIdTrimmed);
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
      return sensorStore.listSensorDevicesForUserAsync(ownerUserId);
    },
    async insertSensorDevice(p) {
      return sensorStore.insertSensorDeviceAsync(p);
    },
    async getSensorDeviceForUser(ownerUserId, deviceId) {
      return sensorStore.getSensorDeviceForUserAsync(ownerUserId, deviceId);
    },
    async getLatestSensorReading(ownerUserId, deviceId) {
      return sensorStore.getLatestSensorReadingAsync(ownerUserId, deviceId);
    },
    async getSensorReadingsHistory(ownerUserId, deviceId, limit) {
      return sensorStore.getSensorReadingsHistoryAsync(ownerUserId, deviceId, limit);
    },
    async listSensorReadingsLog(ownerUserId, deviceId, limit) {
      return sensorStore.listSensorReadingsLogAsync(ownerUserId, deviceId, limit);
    },
    async insertSensorReading(p) {
      return sensorStore.insertSensorReadingAsync(p);
    },
    async deleteSensorDevice(ownerUserId, deviceId) {
      return sensorStore.deleteSensorDeviceAsync(ownerUserId, deviceId);
    },
    async regenerateSensorDeviceApiKey(ownerUserId, deviceIdTrim) {
      return sensorStore.regenerateSensorDeviceApiKeyAsync(ownerUserId, deviceIdTrim);
    },
  };
}
