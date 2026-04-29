/**
 * Sensor devices + readings in MySQL (`sensor_devices`, `sensor_readings`).
 */
import crypto from 'node:crypto';
import { getDb } from './db.js';

/**
 * MySQL `JSON` columns can come back from `mysql2` either as a string or as an already-parsed object.
 * Keep history endpoints resilient and avoid 500s from `JSON.parse` on non-strings.
 * @param {unknown} v
 * @returns {Record<string, unknown>}
 */
function safeParseJsonColumn(v) {
  if (v == null) return {};
  if (typeof v === 'object') return v;
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  try {
    const parsed = JSON.parse(String(v));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

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

export async function getSensorDeviceRowByDeviceIdAsync(deviceId) {
  const db = await getDb();
  const [rows] = await db.execute('SELECT * FROM sensor_devices WHERE device_id = ? LIMIT 1', [String(deviceId ?? '').trim()]);
  return rows[0];
}

export async function listSensorDevicesForUserAsync(ownerUserId) {
  const db = await getDb();
  const [rows] = await db.execute(
    `SELECT device_id, name, sensor_type, location, status, last_seen_at, created_at, updated_at
     FROM sensor_devices
     WHERE owner_user_id = ?
     ORDER BY updated_at DESC`,
    [ownerUserId],
  );
  return rows.map((row) => rowToDevicePublic(row));
}

export async function insertSensorDeviceAsync(p) {
  const db = await getDb();
  const [existingRows] = await db.execute('SELECT owner_user_id FROM sensor_devices WHERE device_id = ? LIMIT 1', [p.deviceId]);
  const existing = existingRows[0];
  if (existing) {
    if (existing.owner_user_id !== p.ownerUserId) return { ok: false, code: 'other_user' };
    return { ok: false, code: 'duplicate' };
  }

  const id = crypto.randomUUID();
  const now = new Date();
  await db.execute(
    `INSERT INTO sensor_devices (
      id, owner_user_id, device_id, name, sensor_type, location, api_key, status, last_seen_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'offline', NULL, ?, ?)`,
    [id, p.ownerUserId, p.deviceId, p.name, p.sensorType, p.location, p.apiKey, now, now],
  );

  const [rows] = await db.execute('SELECT * FROM sensor_devices WHERE id = ? LIMIT 1', [id]);
  const row = rows[0];
  return { ok: true, device: rowToDevicePublic(row), apiKey: p.apiKey };
}

export async function getSensorDeviceForUserAsync(ownerUserId, deviceId) {
  const db = await getDb();
  const [rows] = await db.execute('SELECT * FROM sensor_devices WHERE owner_user_id = ? AND device_id = ? LIMIT 1', [
    ownerUserId,
    deviceId,
  ]);
  return rowToDevicePublic(rows[0]);
}

export async function getLatestSensorReadingAsync(ownerUserId, deviceId) {
  const db = await getDb();
  const [rows] = await db.execute(
    `SELECT sensor_type, data_json, created_at FROM sensor_readings
     WHERE owner_user_id = ? AND device_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [ownerUserId, deviceId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    sensorType: row.sensor_type,
    data: safeParseJsonColumn(row.data_json),
    createdAt: row.created_at,
  };
}

export async function getSensorReadingsHistoryAsync(ownerUserId, deviceId, limit) {
  const db = await getDb();
  const [rows] = await db.execute(
    `SELECT sensor_type, data_json, created_at FROM sensor_readings
     WHERE owner_user_id = ? AND device_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [ownerUserId, deviceId, limit],
  );
  return rows.map((r) => ({
    sensorType: r.sensor_type,
    data: safeParseJsonColumn(r.data_json),
    createdAt: r.created_at,
  }));
}

export async function listSensorReadingsLogAsync(ownerUserId, deviceId, limit) {
  const lim = Math.min(500, Math.max(1, limit));
  const db = await getDb();
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
  const [rows] = filterId
    ? await db.execute(sql, [ownerUserId, filterId, lim])
    : await db.execute(sql, [ownerUserId, lim]);
  return rows.map((r) => ({
    deviceId: r.device_id,
    deviceName: r.device_name,
    deviceStatus: r.device_status,
    sensorType: r.sensor_type,
    data: safeParseJsonColumn(r.data_json),
    createdAt: r.created_at,
  }));
}

export async function insertSensorReadingAsync(p) {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date();
  const dataJson = JSON.stringify(p.data);

  await db.execute(
    `INSERT INTO sensor_readings (id, owner_user_id, device_id, sensor_type, data_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, p.ownerUserId, p.deviceId, p.sensorType, dataJson, now],
  );

  await db.execute(
    `UPDATE sensor_devices SET status = 'online', last_seen_at = ?, updated_at = ? WHERE device_id = ?`,
    [now, now, p.deviceId],
  );

  return { id, createdAt: now, data: p.data };
}

export async function deleteSensorDeviceAsync(ownerUserId, deviceId) {
  const db = await getDb();
  const [r] = await db.execute('DELETE FROM sensor_devices WHERE owner_user_id = ? AND device_id = ?', [
    ownerUserId,
    deviceId.trim(),
  ]);
  return r.affectedRows > 0;
}

export async function regenerateSensorDeviceApiKeyAsync(ownerUserId, deviceIdTrim) {
  const id = String(deviceIdTrim ?? '').trim();
  if (!id) return { ok: false };
  const db = await getDb();
  const [rows] = await db.execute('SELECT id FROM sensor_devices WHERE owner_user_id = ? AND device_id = ? LIMIT 1', [
    ownerUserId,
    id,
  ]);
  const row = rows[0];
  if (!row) return { ok: false };

  const newKey = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  await db.execute('UPDATE sensor_devices SET api_key = ?, updated_at = ? WHERE id = ?', [newKey, now, row.id]);
  return { ok: true, apiKey: newKey };
}
