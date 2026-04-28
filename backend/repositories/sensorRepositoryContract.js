/**
 * Sensor repository contract (JSDoc only — no runtime).
 * All methods return Promises.
 *
 * @typedef {{ ownerUserId: string; deviceId: string; sensorType: string }} SensorDeviceContext
 * @typedef {{ ok: true, sensorDevice: SensorDeviceContext } | { ok: false, error: 'device_not_found' | 'invalid_key' }} AuthenticateDeviceResult
 *
 * @typedef {Object} SensorRepository
 * @property {(deviceId: string, apiKey: string) => Promise<AuthenticateDeviceResult>} authenticateDevice deviceId and apiKey must already be trimmed where required
 * @property {(ownerUserId: string) => Promise<object[]>} listSensorDevicesForUser
 * @property {(p: object) => Promise<object>} insertSensorDevice
 * @property {(ownerUserId: string, deviceId: string) => Promise<object | null>} getSensorDeviceForUser
 * @property {(ownerUserId: string, deviceId: string) => Promise<object | null>} getLatestSensorReading
 * @property {(ownerUserId: string, deviceId: string, limit: number) => Promise<object[]>} getSensorReadingsHistory
 * @property {(ownerUserId: string, deviceId: string | undefined, limit: number) => Promise<object[]>} listSensorReadingsLog
 * @property {(p: object) => Promise<object>} insertSensorReading
 * @property {(ownerUserId: string, deviceId: string) => Promise<boolean>} deleteSensorDevice
 * @property {(ownerUserId: string, deviceId: string) => Promise<object>} regenerateSensorDeviceApiKey
 */

export {};
