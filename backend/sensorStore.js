/**
 * Sensor devices + readings in Supabase Postgres (`sensor_devices`, `sensor_readings`).
 * API key security: bcrypt hashing with api_key_lookup for efficient lookup.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getDb } from './db.js';

const BCRYPT_ROUNDS = 12;

/**
 * Helper to generate a new API key and compute its hash and lookup value.
 * @returns {{ apiKey: string; apiKeyHash: string; apiKeyLookup: string }}
 */
function generateApiKeyPair() {
  const apiKey = crypto.randomBytes(32).toString('hex');
  const apiKeyHash = bcrypt.hashSync(apiKey, BCRYPT_ROUNDS);
  const apiKeyLookup = crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 64);
  return { apiKey, apiKeyHash, apiKeyLookup };
}

/**
 * Keep history endpoints resilient and avoid 500s from `JSON.parse` on non-objects.
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
  const { data, error } = await db.from('sensor_devices').select('*').eq('device_id', String(deviceId ?? '').trim()).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Get device by api_key_lookup for secure authentication.
 * Returns the full row including api_key_hash for bcrypt verification.
 */
export async function getSensorDeviceRowByApiKeyLookupAsync(apiKeyLookup) {
  const db = await getDb();
  const { data, error } = await db
    .from('sensor_devices')
    .select('*')
    .eq('api_key_lookup', String(apiKeyLookup ?? '').trim())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listSensorDevicesForUserAsync(ownerUserId) {
  const db = await getDb();
  const { data, error } = await db
    .from('sensor_devices')
    .select('device_id, name, sensor_type, location, status, last_seen_at, created_at, updated_at')
    .eq('owner_user_id', ownerUserId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => rowToDevicePublic(row));
}

export async function insertSensorDeviceAsync(p) {
  const db = await getDb();
  const { data: existing, error: existingError } = await db
    .from('sensor_devices')
    .select('owner_user_id')
    .eq('device_id', p.deviceId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    if (existing.owner_user_id !== p.ownerUserId) return { ok: false, code: 'other_user' };
    return { ok: false, code: 'duplicate' };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const { apiKey, apiKeyHash, apiKeyLookup } = generateApiKeyPair();
  
  const { data, error } = await db
    .from('sensor_devices')
    .insert([
      {
        id,
        owner_user_id: p.ownerUserId,
        device_id: p.deviceId,
        name: p.name,
        sensor_type: p.sensorType,
        location: p.location,
        api_key_hash: apiKeyHash,
        api_key_lookup: apiKeyLookup,
        status: 'offline',
        last_seen_at: null,
        created_at: now,
        updated_at: now,
      },
    ])
    .select('*')
    .single();
  if (error) throw error;
  return { ok: true, device: rowToDevicePublic(data), apiKey };
}

export async function getSensorDeviceForUserAsync(ownerUserId, deviceId) {
  const db = await getDb();
  const { data, error } = await db
    .from('sensor_devices')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .eq('device_id', deviceId)
    .maybeSingle();
  if (error) throw error;
  return rowToDevicePublic(data);
}

export async function getLatestSensorReadingAsync(ownerUserId, deviceId) {
  const db = await getDb();
  const { data, error } = await db
    .from('sensor_readings')
    .select('sensor_type, data_json, created_at')
    .eq('owner_user_id', ownerUserId)
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    sensorType: data.sensor_type,
    data: safeParseJsonColumn(data.data_json),
    createdAt: data.created_at,
  };
}

export async function getSensorReadingsHistoryAsync(ownerUserId, deviceId, limit) {
  const lim = Math.min(500, Math.max(1, Number(limit) || 50));
  const db = await getDb();
  const { data, error } = await db
    .from('sensor_readings')
    .select('sensor_type, data_json, created_at')
    .eq('owner_user_id', ownerUserId)
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(lim);
  if (error) throw error;
  return (data || []).map((r) => ({
    sensorType: r.sensor_type,
    data: safeParseJsonColumn(r.data_json),
    createdAt: r.created_at,
  }));
}

export async function listSensorReadingsLogAsync(ownerUserId, deviceId, limit) {
  const lim = Math.min(500, Math.max(1, Number(limit) || 100));
  const db = await getDb();
  const filterId = typeof deviceId === 'string' && deviceId.trim() ? deviceId.trim() : null;

  const readingsQuery = db
    .from('sensor_readings')
    .select('device_id, sensor_type, data_json, created_at')
    .eq('owner_user_id', ownerUserId)
    .order('created_at', { ascending: false })
    .limit(lim);
  if (filterId) readingsQuery.eq('device_id', filterId);

  const { data: readings, error: readingsError } = await readingsQuery;
  if (readingsError) throw readingsError;
  const rows = readings || [];

  const deviceIds = filterId ? [filterId] : [...new Set(rows.map((row) => row.device_id))];
  const devicesResult = deviceIds.length
    ? await db
        .from('sensor_devices')
        .select('device_id, name, status')
        .eq('owner_user_id', ownerUserId)
        .in('device_id', deviceIds)
    : { data: [] };
  if (devicesResult.error) throw devicesResult.error;

  const deviceById = new Map((devicesResult.data || []).map((deviceRow) => [deviceRow.device_id, deviceRow]));

  return rows.map((r) => {
    const device = deviceById.get(r.device_id) || { name: null, status: null };
    return {
      deviceId: r.device_id,
      deviceName: device.name,
      deviceStatus: device.status,
      sensorType: r.sensor_type,
      data: safeParseJsonColumn(r.data_json),
      createdAt: r.created_at,
    };
  });
}

export async function insertSensorReadingAsync(p) {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { error: insertError } = await db.from('sensor_readings').insert([
    {
      id,
      owner_user_id: p.ownerUserId,
      device_id: p.deviceId,
      sensor_type: p.sensorType,
      data_json: p.data,
      created_at: now,
    },
  ]);
  if (insertError) throw insertError;

  const { error: updateError } = await db
    .from('sensor_devices')
    .update({ status: 'online', last_seen_at: now, updated_at: now })
    .eq('device_id', p.deviceId);
  if (updateError) throw updateError;

  return { id, createdAt: now, data: p.data };
}

export async function deleteSensorDeviceAsync(ownerUserId, deviceId) {
  const db = await getDb();
  const { data, error } = await db
    .from('sensor_devices')
    .delete()
    .eq('owner_user_id', ownerUserId)
    .eq('device_id', deviceId.trim());
  if (error) throw error;
  return !!(data && data.length > 0);
}

export async function regenerateSensorDeviceApiKeyAsync(ownerUserId, deviceIdTrim) {
  const id = String(deviceIdTrim ?? '').trim();
  if (!id) return { ok: false };
  const db = await getDb();
  const { data: row, error: rowError } = await db
    .from('sensor_devices')
    .select('id')
    .eq('owner_user_id', ownerUserId)
    .eq('device_id', id)
    .maybeSingle();
  if (rowError) throw rowError;
  if (!row) return { ok: false };

  const { apiKey, apiKeyHash, apiKeyLookup } = generateApiKeyPair();
  const now = new Date().toISOString();
  const { error: updateError } = await db
    .from('sensor_devices')
    .update({ api_key_hash: apiKeyHash, api_key_lookup: apiKeyLookup, updated_at: now })
    .eq('id', row.id);
  if (updateError) throw updateError;
  return { ok: true, apiKey };
}
