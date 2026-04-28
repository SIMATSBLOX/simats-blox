import { getSensorRepository } from '../../repositories/getSensorRepository.js';

/**
 * Expects JSON body with deviceId. Header x-device-key must match stored api_key.
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

    const result = await getSensorRepository().authenticateDevice(deviceId.trim(), key.trim());
    if (!result.ok) {
      if (result.error === 'device_not_found') {
        return res.status(404).json({ error: 'Unknown deviceId.' });
      }
      return res.status(401).json({ error: 'Invalid device key.' });
    }

    req.sensorDevice = result.sensorDevice;
    next();
  } catch (e) {
    console.error('[authDevice]', e);
    return res.status(500).json({ error: 'Device authentication failed.' });
  }
}
