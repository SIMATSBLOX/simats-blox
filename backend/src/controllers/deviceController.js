import crypto from 'node:crypto';
import { Device, SENSOR_TYPES } from '../models/Device.js';
import { SensorReading } from '../models/SensorReading.js';

const TYPE_SET = new Set(SENSOR_TYPES);

export async function registerDevice(req, res) {
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
    const existing = await Device.findOne({ deviceId: trimmedId }).lean();
    if (existing) {
      if (existing.ownerUserId !== userId) {
        return res.status(409).json({ error: 'This deviceId is already registered to another account.' });
      }
      return res.status(409).json({ error: 'You have already registered this deviceId.' });
    }

    const key =
      typeof apiKey === 'string' && apiKey.trim().length >= 16
        ? apiKey.trim()
        : crypto.randomBytes(32).toString('hex');

    const device = await Device.create({
      ownerUserId: userId,
      deviceId: trimmedId,
      name: name.trim(),
      sensorType,
      location: typeof location === 'string' ? location.trim() : '',
      apiKey: key,
      status: 'offline',
    });

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
    if (e?.name === 'ValidationError') {
      return res.status(400).json({ error: String(e.message || 'Validation failed.') });
    }
    console.error('[registerDevice]', e);
    res.status(500).json({ error: 'Could not register device.' });
  }
}

export async function listDevices(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Sign in required.' });
    }
    const devices = await Device.find({ ownerUserId: userId })
      .select('-apiKey')
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ devices });
  } catch (e) {
    console.error('[listDevices]', e);
    res.status(500).json({ error: 'Could not list devices.' });
  }
}

export async function getLatestForDevice(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Sign in required.' });
    }
    const { deviceId } = req.params;
    const device = await Device.findOne({ deviceId, ownerUserId: userId }).select('-apiKey').lean();
    if (!device) {
      return res.status(404).json({ error: 'Device not found.' });
    }
    const latest = await SensorReading.findOne({ deviceId, ownerUserId: userId })
      .sort({ createdAt: -1 })
      .lean();
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

export async function getHistory(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Sign in required.' });
    }
    const { deviceId } = req.params;
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 50));
    const device = await Device.findOne({ deviceId, ownerUserId: userId }).select('-apiKey').lean();
    if (!device) {
      return res.status(404).json({ error: 'Device not found.' });
    }
    const readings = await SensorReading.find({ deviceId, ownerUserId: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('sensorType data createdAt')
      .lean();
    res.json({ device, readings, count: readings.length });
  } catch (e) {
    console.error('[getHistory]', e);
    res.status(500).json({ error: 'Could not load history.' });
  }
}
