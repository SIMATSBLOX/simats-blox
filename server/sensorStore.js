/**
 * Sensor devices + readings in SQLite (`sensor_devices`, `sensor_readings` in server/db.js).
 */
import crypto from 'node:crypto';
import { getDb } from './db.js';

/**
 * Map DB row to API device shape (no api key).
 * @param {object} row
 */
function rowToDevicePublic(row) {
  if (!row) return null;
  return {
    deviceId: row.device_id,
    name: row.name,
    sensorType: row.sensor_type,
    location: row.location,
    status: row.status,
    lastSeenAt: row.last_seen_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * @param {string} deviceId
 * @returns {object | undefined}
 */
export function getSensorDeviceRowByDeviceId(deviceId) {
  const db = getDb();
  return db.prepare('SELECT * FROM sensor_devices WHERE device_id = ?').get(String(deviceId ?? '').trim());
}

/**
 * @param {string} ownerUserId
 * @returns {object[]}
 */
export function listSensorDevicesForUser(ownerUserId) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT device_id, name, sensor_type, location, status, last_seen_at, created_at, updated_at
       FROM sensor_devices
       WHERE owner_user_id = ?
       ORDER BY updated_at DESC`,
    )
    .all(ownerUserId);
  return rows.map((row) => rowToDevicePublic(row));
}

/**
 * @param {{
 *   ownerUserId: string;
 *   deviceId: string;
 *   name: string;
 *   sensorType: string;
 *   location: string;
 *   apiKey: string;
 * }} p
 * @returns {{ ok: true, device: object, apiKey: string } | { ok: false, code: 'duplicate' | 'other_user' }}
 */
export function insertSensorDevice(p) {
  const db = getDb();
  const existing = db.prepare('SELECT owner_user_id FROM sensor_devices WHERE device_id = ?').get(p.deviceId);
  if (existing) {
    if (existing.owner_user_id !== p.ownerUserId) return { ok: false, code: 'other_user' };
    return { ok: false, code: 'duplicate' };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO sensor_devices (
      id, owner_user_id, device_id, name, sensor_type, location, api_key, status, last_seen_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'offline', NULL, ?, ?)`,
  ).run(id, p.ownerUserId, p.deviceId, p.name, p.sensorType, p.location, p.apiKey, now, now);

  const row = db.prepare('SELECT * FROM sensor_devices WHERE id = ?').get(id);
  return { ok: true, device: rowToDevicePublic(row), apiKey: p.apiKey };
}

/**
 * @param {string} ownerUserId
 * @param {string} deviceId
 * @returns {object | null} public device
 */
export function getSensorDeviceForUser(ownerUserId, deviceId) {
  const row = getDb()
    .prepare('SELECT * FROM sensor_devices WHERE owner_user_id = ? AND device_id = ?')
    .get(ownerUserId, deviceId);
  return rowToDevicePublic(row);
}

/**
 * @param {string} ownerUserId
 * @param {string} deviceId
 */
export function getLatestSensorReading(ownerUserId, deviceId) {
  const row = getDb()
    .prepare(
      `SELECT sensor_type, data_json, created_at FROM sensor_readings
       WHERE owner_user_id = ? AND device_id = ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(ownerUserId, deviceId);
  if (!row) return null;
  return {
    sensorType: row.sensor_type,
    data: JSON.parse(row.data_json),
    createdAt: row.created_at,
  };
}

/**
 * @param {string} ownerUserId
 * @param {string} deviceId
 * @param {number} limit
 */
export function getSensorReadingsHistory(ownerUserId, deviceId, limit) {
  const rows = getDb()
    .prepare(
      `SELECT sensor_type, data_json, created_at FROM sensor_readings
       WHERE owner_user_id = ? AND device_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(ownerUserId, deviceId, limit);
  return rows.map((r) => ({
    sensorType: r.sensor_type,
    data: JSON.parse(r.data_json),
    createdAt: r.created_at,
  }));
}

/**
 * Cross-device reading log for the dashboard (newest first). Optional `deviceId` filters to one device.
 * @param {string} ownerUserId
 * @param {string | undefined} deviceId
 * @param {number} limit
 * @returns {{ deviceId: string, deviceName: string, deviceStatus: string, sensorType: string, data: object, createdAt: string }[]}
 */
export function listSensorReadingsLog(ownerUserId, deviceId, limit) {
  const lim = Math.min(500, Math.max(1, limit));
  const db = getDb();
  const filterId = typeof deviceId === 'string' && deviceId.trim() ? deviceId.trim() : null;
  const sql = filterId
    ? `SELECT r.device_id, d.name AS device_name, d.status AS device_status,
              r.sensor_type, r.data_json, r.created_at
        FROM sensor_readings r
        INNER JOIN sensor_devices d
          ON d.device_id = r.device_id AND d.owner_user_id = r.owner_user_id
        WHERE r.owner_user_id = ? AND r.device_id = ?
        ORDER BY r.created_at DESC
        LIMIT ?`
    : `SELECT r.device_id, d.name AS device_name, d.status AS device_status,
              r.sensor_type, r.data_json, r.created_at
        FROM sensor_readings r
        INNER JOIN sensor_devices d
          ON d.device_id = r.device_id AND d.owner_user_id = r.owner_user_id
        WHERE r.owner_user_id = ?
        ORDER BY r.created_at DESC
        LIMIT ?`;
  const rows = filterId ? db.prepare(sql).all(ownerUserId, filterId, lim) : db.prepare(sql).all(ownerUserId, lim);
  return rows.map((r) => ({
    deviceId: r.device_id,
    deviceName: r.device_name,
    deviceStatus: r.device_status,
    sensorType: r.sensor_type,
    data: JSON.parse(r.data_json),
    createdAt: r.created_at,
  }));
}

/**
 * @param {{
 *   ownerUserId: string;
 *   deviceId: string;
 *   sensorType: string;
 *   data: object;
 * }} p
 * @returns {{ id: string, createdAt: string, data: object }}
 */
export function insertSensorReading(p) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const dataJson = JSON.stringify(p.data);

  db.prepare(
    `INSERT INTO sensor_readings (id, owner_user_id, device_id, sensor_type, data_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, p.ownerUserId, p.deviceId, p.sensorType, dataJson, now);

  db.prepare(
    `UPDATE sensor_devices SET status = 'online', last_seen_at = ?, updated_at = ? WHERE device_id = ?`,
  ).run(now, now, p.deviceId);

  return { id, createdAt: now, data: p.data };
}

/**
 * @param {string} ownerUserId
 * @param {string} deviceId
 * @returns {boolean}
 */
export function deleteSensorDevice(ownerUserId, deviceId) {
  const r = getDb()
    .prepare('DELETE FROM sensor_devices WHERE owner_user_id = ? AND device_id = ?')
    .run(ownerUserId, deviceId.trim());
  return r.changes > 0;
}

/**
 * Replace api_key; previous key stops working on the next request.
 * @param {string} ownerUserId
 * @param {string} deviceIdTrim
 * @returns {{ ok: true, apiKey: string } | { ok: false }}
 */
export function regenerateSensorDeviceApiKey(ownerUserId, deviceIdTrim) {
  const id = String(deviceIdTrim ?? '').trim();
  if (!id) return { ok: false };
  const db = getDb();
  const row = db
    .prepare('SELECT id FROM sensor_devices WHERE owner_user_id = ? AND device_id = ?')
    .get(ownerUserId, id);
  if (!row) return { ok: false };

  const newKey = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();
  db.prepare('UPDATE sensor_devices SET api_key = ?, updated_at = ? WHERE id = ?').run(newKey, now, row.id);
  return { ok: true, apiKey: newKey };
}
