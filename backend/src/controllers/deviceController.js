import crypto from 'node:crypto';
import { SENSOR_TYPES } from '../constants/sensorTypes.js';
import { getSensorRepository } from '../../../server/repositories/getSensorRepository.js';

const TYPE_SET = new Set(SENSOR_TYPES);

export function registerDevice(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Sign in required.' });
    }

    const { deviceId, name, sensorType, location, apiKey } = req.body ?? {};
    if (typeof deviceId !== 'string' || !deviceId.trim()) {
      return res.status(400).json({ error: 'deviceId is required.' });
    }
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required.' });
    }
    if (typeof sensorType !== 'string' || !TYPE_SET.has(sensorType)) {
      return res.status(400).json({ error: `sensorType must be one of: ${SENSOR_TYPES.join(', ')}.` });
    }

    const trimmedId = deviceId.trim();
    const key =
      typeof apiKey === 'string' && apiKey.trim().length >= 16
        ? apiKey.trim()
        : crypto.randomBytes(32).toString('hex');

    const inserted = getSensorRepository().insertSensorDevice({
      ownerUserId: userId,
      deviceId: trimmedId,
      name: name.trim(),
      sensorType,
      location: typeof location === 'string' ? location.trim() : '',
      apiKey: key,
    });

    if (!inserted.ok) {
      if (inserted.code === 'other_user') {
        return res.status(409).json({ error: 'This deviceId is already registered to another account.' });
      }
      return res.status(409).json({ error: 'You have already registered this deviceId.' });
    }

    const { device } = inserted;
    res.status(201).json({
      deviceId: device.deviceId,
      name: device.name,
      sensorType: device.sensorType,
      location: device.location,
      status: device.status,
      apiKey: key,
      createdAt: device.createdAt,
    });
  } catch (e) {
    console.error('[registerDevice]', e);
    res.status(500).json({ error: 'Could not register device.' });
  }
}

export function listDevices(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Sign in required.' });
    }
    const devices = getSensorRepository().listSensorDevicesForUser(userId);
    res.json({ devices });
  } catch (e) {
    console.error('[listDevices]', e);
    res.status(500).json({ error: 'Could not list devices.' });
  }
}

export function getLatestForDevice(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Sign in required.' });
    }
    const { deviceId } = req.params;
    const repo = getSensorRepository();
    const device = repo.getSensorDeviceForUser(userId, deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found.' });
    }
    const latest = repo.getLatestSensorReading(userId, deviceId);
    res.json({
      device,
      latest: latest
        ? {
            sensorType: latest.sensorType,
            data: latest.data,
            createdAt: latest.createdAt,
          }
        : null,
    });
  } catch (e) {
    console.error('[getLatestForDevice]', e);
    res.status(500).json({ error: 'Could not load latest reading.' });
  }
}

export function getHistory(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Sign in required.' });
    }
    const { deviceId } = req.params;
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 50));
    const repo = getSensorRepository();
    const device = repo.getSensorDeviceForUser(userId, deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found.' });
    }
    const readings = repo.getSensorReadingsHistory(userId, deviceId, limit);
    res.json({ device, readings, count: readings.length });
  } catch (e) {
    console.error('[getHistory]', e);
    res.status(500).json({ error: 'Could not load history.' });
  }
}

/** GET /api/readings/history — all devices or one device; newest first. */
export function listReadingsHistory(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Sign in required.' });
    }
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const repo = getSensorRepository();
    const raw = req.query.deviceId;
    let filterDeviceId;
    if (typeof raw === 'string' && raw.trim()) {
      const trimmed = raw.trim();
      if (!repo.getSensorDeviceForUser(userId, trimmed)) {
        return res.status(404).json({ error: 'Device not found.' });
      }
      filterDeviceId = trimmed;
    }
    const readings = repo.listSensorReadingsLog(userId, filterDeviceId, limit);
    res.json({ readings, count: readings.length });
  } catch (e) {
    console.error('[listReadingsHistory]', e);
    res.status(500).json({ error: 'Could not load readings log.' });
  }
}

export function deleteDevice(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Sign in required.' });
    }
    const { deviceId } = req.params;
    if (typeof deviceId !== 'string' || !deviceId.trim()) {
      return res.status(400).json({ error: 'deviceId is required.' });
    }
    const removed = getSensorRepository().deleteSensorDevice(userId, deviceId.trim());
    if (!removed) {
      return res.status(404).json({ error: 'Device not found.' });
    }
    res.status(204).end();
  } catch (e) {
    console.error('[deleteDevice]', e);
    res.status(500).json({ error: 'Could not delete device.' });
  }
}

export function regenerateDeviceKey(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Sign in required.' });
    }
    const { deviceId } = req.params;
    if (typeof deviceId !== 'string' || !deviceId.trim()) {
      return res.status(400).json({ error: 'deviceId is required.' });
    }
    const out = getSensorRepository().regenerateSensorDeviceApiKey(userId, deviceId.trim());
    if (!out.ok) {
      return res.status(404).json({ error: 'Device not found.' });
    }
    res.json({
      deviceId: deviceId.trim(),
      apiKey: out.apiKey,
    });
  } catch (e) {
    console.error('[regenerateDeviceKey]', e);
    res.status(500).json({ error: 'Could not regenerate key.' });
  }
}
