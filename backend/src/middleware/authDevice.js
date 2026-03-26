import crypto from 'node:crypto';
import { Device } from '../models/Device.js';

function safeEqual(a, b) {
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
 * Expects JSON body with deviceId. Header x-device-key must match stored apiKey.
 */
export async function authDevice(req, res, next) {
  try {
    const key = req.headers['x-device-key'];
    if (typeof key !== 'string' || !key.trim()) {
      return res.status(401).json({ error: 'Missing x-device-key header.' });
    }
    const deviceId = req.body?.deviceId;
    if (typeof deviceId !== 'string' || !deviceId.trim()) {
      return res.status(400).json({ error: 'deviceId is required in body.' });
    }

    const device = await Device.findOne({ deviceId: deviceId.trim() }).lean();
    if (!device) {
      return res.status(404).json({ error: 'Unknown deviceId.' });
    }
    if (!safeEqual(device.apiKey, key.trim())) {
      return res.status(401).json({ error: 'Invalid device key.' });
    }

    req.sensorDevice = device;
    next();
  } catch (e) {
    console.error('[authDevice]', e);
    return res.status(500).json({ error: 'Device authentication failed.' });
  }
}
