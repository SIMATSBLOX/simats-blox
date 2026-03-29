/**
 * SQLite sensor persistence — delegates to `server/sensorStore.js`.
 * Plaintext api_key verification (unchanged); future Supabase repo will use hash + lookup.
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
    authenticateDevice(deviceIdTrimmed, apiKeyTrimmed) {
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

    listSensorDevicesForUser: sensorStore.listSensorDevicesForUser,
    insertSensorDevice: sensorStore.insertSensorDevice,
    getSensorDeviceForUser: sensorStore.getSensorDeviceForUser,
    getLatestSensorReading: sensorStore.getLatestSensorReading,
    getSensorReadingsHistory: sensorStore.getSensorReadingsHistory,
    listSensorReadingsLog: sensorStore.listSensorReadingsLog,
    insertSensorReading: sensorStore.insertSensorReading,
    deleteSensorDevice: sensorStore.deleteSensorDevice,
    regenerateSensorDeviceApiKey: sensorStore.regenerateSensorDeviceApiKey,
  };
}
