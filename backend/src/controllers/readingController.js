import { validateReadingPayload } from '../utils/validateReadingPayload.js';
import { emitSensorUpdate } from '../services/socketService.js';
import { getSensorRepository } from '../../../server/repositories/getSensorRepository.js';

export function receiveReading(req, res) {
  try {
    const parsed = validateReadingPayload(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: 'Invalid payload.', details: parsed.errors });
    }
    const { deviceId, sensorType, data } = parsed.value;
    const dev = req.sensorDevice;
    if (!dev) {
      return res.status(500).json({ error: 'Device context missing.' });
    }
    if (dev.sensorType !== sensorType) {
      return res.status(400).json({
        error: `sensorType mismatch: device is registered as ${dev.sensorType}, payload is ${sensorType}.`,
      });
    }
    if (dev.deviceId !== deviceId) {
      return res.status(400).json({ error: 'deviceId in body must match authenticated device.' });
    }

    const ownerUserId = String(dev.ownerUserId || '');
    if (!ownerUserId) {
      return res.status(403).json({
        error: 'Device is not linked to an account. Register it from SIMATS BLOX → Devices (signed in).',
      });
    }

    const doc = getSensorRepository().insertSensorReading({
      ownerUserId,
      deviceId,
      sensorType,
      data,
    });

    emitSensorUpdate({
      ownerUserId,
      deviceId,
      sensorType,
      data: doc.data,
      createdAt: doc.createdAt,
    });

    res.status(201).json({
      ok: true,
      readingId: doc.id,
      createdAt: doc.createdAt,
    });
  } catch (e) {
    console.error('[receiveReading]', e);
    res.status(500).json({ error: 'Could not save reading.' });
  }
}
