/**
 * Sensor repository contract (JSDoc only — no runtime).
 * SQLite implementation is synchronous; a future Supabase adapter may use async methods.
 *
 * @typedef {{ ownerUserId: string; deviceId: string; sensorType: string }} SensorDeviceContext
 * @typedef {{ ok: true, sensorDevice: SensorDeviceContext } | { ok: false, error: 'device_not_found' | 'invalid_key' }} AuthenticateDeviceResult
 *
 * @typedef {Object} SensorRepository
 * @property {(deviceId: string, apiKey: string) => AuthenticateDeviceResult} authenticateDevice deviceId and apiKey must already be trimmed where required
 * @property {(ownerUserId: string) => object[]} listSensorDevicesForUser
 * @property {(p: object) => object} insertSensorDevice
 * @property {(ownerUserId: string, deviceId: string) => object | null} getSensorDeviceForUser
 * @property {(ownerUserId: string, deviceId: string) => object | null} getLatestSensorReading
 * @property {(ownerUserId: string, deviceId: string, limit: number) => object[]} getSensorReadingsHistory
 * @property {(ownerUserId: string, deviceId: string | undefined, limit: number) => object[]} listSensorReadingsLog
 * @property {(p: object) => object} insertSensorReading
 * @property {(ownerUserId: string, deviceId: string) => boolean} deleteSensorDevice
 * @property {(ownerUserId: string, deviceId: string) => object} regenerateSensorDeviceApiKey
 */

export {};
