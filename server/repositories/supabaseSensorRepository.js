/**
 * Sensor persistence in Supabase Postgres (`sensor_devices`, `sensor_readings`).
 * Uses service-role client (bypasses RLS). Intended when JWT `sub` is `auth.users.id`.
 *
 * Transitional device keys: `api_key_hash` and `api_key_lookup` both store the same SHA-256
 * hex of `DEVICE_KEY_PEPPER + "\\0" + rawApiKey` (no plaintext in DB). ESP32 still sends the raw key.
 */
import crypto from 'node:crypto';
import { getSupabaseServiceClient } from '../supabaseServiceClient.js';

function timingSafeEqualHex(a, b) {
  const s1 = String(a ?? '');
  const s2 = String(b ?? '');
  if (s1.length !== s2.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(s1, 'hex'), Buffer.from(s2, 'hex'));
  } catch {
    return false;
  }
}

function requirePepper() {
  const p = process.env.DEVICE_KEY_PEPPER?.trim();
  if (!p || p.length < 16) {
    throw new Error(
      '[sensor] DEVICE_KEY_PEPPER must be set (min 16 chars) for Supabase device key hashing.',
    );
  }
  return p;
}

/** @param {string} rawApiKey */
function hashDeviceKey(rawApiKey) {
  const pepper = requirePepper();
  return crypto
    .createHash('sha256')
    .update(pepper, 'utf8')
    .update('\0', 'utf8')
    .update(String(rawApiKey), 'utf8')
    .digest('hex');
}

/**
 * @param {object} row — snake_case row from PostgREST
 */
function rowToDevicePublic(row) {
  if (!row) return null;
  return {
    deviceId: row.device_id,
    name: row.name,
    sensorType: row.sensor_type,
    location: row.location ?? '',
    status: row.status,
    lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : '',
  };
}

function isoNow() {
  return new Date().toISOString();
}

/**
 * @returns {import('./sensorRepositoryContract.js').SensorRepository}
 */
export function createSupabaseSensorRepository() {
  const sb = () => getSupabaseServiceClient();

  return {
    async authenticateDevice(deviceIdTrimmed, apiKeyTrimmed) {
      const lookup = hashDeviceKey(apiKeyTrimmed);
      const { data: row, error } = await sb()
        .from('sensor_devices')
        .select('user_id, device_id, sensor_type, api_key_hash, api_key_lookup')
        .eq('api_key_lookup', lookup)
        .maybeSingle();

      if (error) {
        console.error('[supabaseSensor] authenticateDevice', error.message);
        return { ok: false, error: 'device_not_found' };
      }
      if (!row) {
        return { ok: false, error: 'invalid_key' };
      }
      if (!timingSafeEqualHex(row.api_key_hash, lookup)) {
        return { ok: false, error: 'invalid_key' };
      }
      if (row.device_id !== deviceIdTrimmed) {
        return { ok: false, error: 'device_not_found' };
      }
      return {
        ok: true,
        sensorDevice: {
          ownerUserId: row.user_id,
          deviceId: row.device_id,
          sensorType: row.sensor_type,
        },
      };
    },

    async listSensorDevicesForUser(ownerUserId) {
      const { data, error } = await sb()
        .from('sensor_devices')
        .select('device_id, name, sensor_type, location, status, last_seen_at, created_at, updated_at')
        .eq('user_id', ownerUserId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[supabaseSensor] listSensorDevicesForUser', error.message);
        throw error;
      }
      return (data ?? []).map((r) => rowToDevicePublic(r));
    },

    async insertSensorDevice(p) {
      const { ownerUserId, deviceId, name, sensorType, location, apiKey } = p;
      const { data: conflicts, error: qErr } = await sb()
        .from('sensor_devices')
        .select('user_id')
        .eq('device_id', deviceId);

      if (qErr) {
        console.error('[supabaseSensor] insertSensorDevice lookup', qErr.message);
        return { ok: false, code: 'other_user' };
      }
      const rows = conflicts ?? [];
      if (rows.length > 0) {
        if (rows.some((r) => r.user_id !== ownerUserId)) {
          return { ok: false, code: 'other_user' };
        }
        return { ok: false, code: 'duplicate' };
      }

      const id = crypto.randomUUID();
      const now = isoNow();
      const keyMat = hashDeviceKey(apiKey);

      const { data: inserted, error } = await sb()
        .from('sensor_devices')
        .insert({
          id,
          user_id: ownerUserId,
          device_id: deviceId,
          name,
          sensor_type: sensorType,
          location: location ?? '',
          api_key_hash: keyMat,
          api_key_lookup: keyMat,
          status: 'offline',
          last_seen_at: null,
          created_at: now,
          updated_at: now,
        })
        .select('device_id, name, sensor_type, location, status, last_seen_at, created_at, updated_at')
        .single();

      if (error) {
        if (error.code === '23505') {
          return { ok: false, code: 'duplicate' };
        }
        console.error('[supabaseSensor] insertSensorDevice', error.message);
        throw error;
      }

      return { ok: true, device: rowToDevicePublic(inserted), apiKey };
    },

    async getSensorDeviceForUser(ownerUserId, deviceId) {
      const { data, error } = await sb()
        .from('sensor_devices')
        .select('*')
        .eq('user_id', ownerUserId)
        .eq('device_id', deviceId)
        .maybeSingle();

      if (error) {
        console.error('[supabaseSensor] getSensorDeviceForUser', error.message);
        throw error;
      }
      return rowToDevicePublic(data);
    },

    async getLatestSensorReading(ownerUserId, deviceId) {
      const { data, error } = await sb()
        .from('sensor_readings')
        .select('sensor_type, data, created_at')
        .eq('user_id', ownerUserId)
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[supabaseSensor] getLatestSensorReading', error.message);
        throw error;
      }
      if (!data) return null;
      return {
        sensorType: data.sensor_type,
        data: typeof data.data === 'object' && data.data !== null ? data.data : {},
        createdAt: new Date(data.created_at).toISOString(),
      };
    },

    async getSensorReadingsHistory(ownerUserId, deviceId, limit) {
      const lim = Math.min(500, Math.max(1, limit));
      const { data, error } = await sb()
        .from('sensor_readings')
        .select('sensor_type, data, created_at')
        .eq('user_id', ownerUserId)
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false })
        .limit(lim);

      if (error) {
        console.error('[supabaseSensor] getSensorReadingsHistory', error.message);
        throw error;
      }
      return (data ?? []).map((r) => ({
        sensorType: r.sensor_type,
        data: typeof r.data === 'object' && r.data !== null ? r.data : {},
        createdAt: new Date(r.created_at).toISOString(),
      }));
    },

    async listSensorReadingsLog(ownerUserId, deviceId, limit) {
      const lim = Math.min(500, Math.max(1, limit));
      let q = sb()
        .from('sensor_readings')
        .select('device_id, device_row_id, sensor_type, data, created_at')
        .eq('user_id', ownerUserId)
        .order('created_at', { ascending: false })
        .limit(lim);

      const filterId = typeof deviceId === 'string' && deviceId.trim() ? deviceId.trim() : null;
      if (filterId) q = q.eq('device_id', filterId);

      const { data: readings, error: rErr } = await q;
      if (rErr) {
        console.error('[supabaseSensor] listSensorReadingsLog readings', rErr.message);
        throw rErr;
      }

      const { data: devices, error: dErr } = await sb()
        .from('sensor_devices')
        .select('id, name, status')
        .eq('user_id', ownerUserId);

      if (dErr) {
        console.error('[supabaseSensor] listSensorReadingsLog devices', dErr.message);
        throw dErr;
      }

      const devMap = new Map((devices ?? []).map((d) => [d.id, d]));

      return (readings ?? []).map((r) => {
        const d = devMap.get(r.device_row_id);
        return {
          deviceId: r.device_id,
          deviceName: d?.name ?? r.device_id,
          deviceStatus: d?.status ?? 'offline',
          sensorType: r.sensor_type,
          data: typeof r.data === 'object' && r.data !== null ? r.data : {},
          createdAt: new Date(r.created_at).toISOString(),
        };
      });
    },

    async insertSensorReading(p) {
      const { ownerUserId, deviceId, sensorType, data: readingData } = p;
      const { data: devRow, error: dErr } = await sb()
        .from('sensor_devices')
        .select('id')
        .eq('user_id', ownerUserId)
        .eq('device_id', deviceId)
        .maybeSingle();

      if (dErr) {
        console.error('[supabaseSensor] insertSensorReading device', dErr.message);
        throw dErr;
      }
      if (!devRow) {
        throw new Error('Device not found for reading insert');
      }

      const id = crypto.randomUUID();
      const now = isoNow();

      const { error: insErr } = await sb().from('sensor_readings').insert({
        id,
        user_id: ownerUserId,
        device_row_id: devRow.id,
        device_id: deviceId,
        sensor_type: sensorType,
        data: readingData,
        created_at: now,
      });

      if (insErr) {
        console.error('[supabaseSensor] insertSensorReading', insErr.message);
        throw insErr;
      }

      const { error: upErr } = await sb()
        .from('sensor_devices')
        .update({ status: 'online', last_seen_at: now, updated_at: now })
        .eq('user_id', ownerUserId)
        .eq('device_id', deviceId);

      if (upErr) {
        console.error('[supabaseSensor] insertSensorReading device update', upErr.message);
      }

      return { id, createdAt: now, data: readingData };
    },

    async deleteSensorDevice(ownerUserId, deviceId) {
      const { data, error } = await sb()
        .from('sensor_devices')
        .delete()
        .eq('user_id', ownerUserId)
        .eq('device_id', deviceId.trim())
        .select('id');

      if (error) {
        console.error('[supabaseSensor] deleteSensorDevice', error.message);
        throw error;
      }
      return Array.isArray(data) && data.length > 0;
    },

    async regenerateSensorDeviceApiKey(ownerUserId, deviceIdTrim) {
      const id = String(deviceIdTrim ?? '').trim();
      if (!id) return { ok: false };

      const { data: row, error: fErr } = await sb()
        .from('sensor_devices')
        .select('id')
        .eq('user_id', ownerUserId)
        .eq('device_id', id)
        .maybeSingle();

      if (fErr || !row) return { ok: false };

      const newKey = crypto.randomBytes(32).toString('hex');
      const keyMat = hashDeviceKey(newKey);
      const now = isoNow();

      const { error: uErr } = await sb()
        .from('sensor_devices')
        .update({
          api_key_hash: keyMat,
          api_key_lookup: keyMat,
          updated_at: now,
        })
        .eq('id', row.id);

      if (uErr) {
        console.error('[supabaseSensor] regenerateSensorDeviceApiKey', uErr.message);
        return { ok: false };
      }

      return { ok: true, apiKey: newKey };
    },
  };
}
