/**
 * Parse one line of Serial Monitor output into a POST /api/readings body.
 * Uses the selected device's id + sensor type unless the line is full JSON with those fields.
 *
 * @param {string} line
 * @param {{ deviceId: string, sensorType: string }} ctx
 * @returns {{ deviceId: string, sensorType: string, data: Record<string, unknown> } | null}
 */
export function parseSerialLineToReading(line, ctx) {
  const deviceId = String(ctx.deviceId ?? '').trim();
  const sensorType = String(ctx.sensorType ?? '').trim();
  if (!deviceId || !sensorType) return null;

  const t = String(line ?? '').trim();
  if (!t) return null;

  if (t.startsWith('{')) {
    try {
      const o = JSON.parse(t);
      if (o && typeof o === 'object' && !Array.isArray(o)) {
        const did = typeof o.deviceId === 'string' && o.deviceId.trim() ? o.deviceId.trim() : deviceId;
        const st =
          typeof o.sensorType === 'string' && o.sensorType.trim() ? o.sensorType.trim() : sensorType;
        if (o.data && typeof o.data === 'object' && !Array.isArray(o.data)) {
          return { deviceId: did, sensorType: st, data: { ...o.data } };
        }
        if (st === 'dht11' && Number.isFinite(Number(o.temperature)) && Number.isFinite(Number(o.humidity))) {
          return {
            deviceId: did,
            sensorType: 'dht11',
            data: { temperature: Number(o.temperature), humidity: Number(o.humidity) },
          };
        }
        if (st === 'dht11' && Number.isFinite(Number(o.t)) && Number.isFinite(Number(o.h))) {
          return {
            deviceId: did,
            sensorType: 'dht11',
            data: { temperature: Number(o.t), humidity: Number(o.h) },
          };
        }
        if (st === 'soil_moisture' && Number.isFinite(Number(o.soilMoisture))) {
          return {
            deviceId: did,
            sensorType: 'soil_moisture',
            data: { soilMoisture: Number(o.soilMoisture) },
          };
        }
        if (st === 'ultrasonic' && Number.isFinite(Number(o.distanceCm))) {
          return {
            deviceId: did,
            sensorType: 'ultrasonic',
            data: { distanceCm: Number(o.distanceCm) },
          };
        }
        if (st === 'lm35' && Number.isFinite(Number(o.temperature))) {
          return {
            deviceId: did,
            sensorType: 'lm35',
            data: { temperature: Number(o.temperature) },
          };
        }
        if (st === 'ir_sensor' && typeof o.irDetected === 'boolean') {
          return {
            deviceId: did,
            sensorType: 'ir_sensor',
            data: { irDetected: o.irDetected },
          };
        }
      }
    } catch {
      /* not valid JSON */
    }
  }

  // Arduino DHT example: Humidity: 45.00%  Temperature: 22.00°C
  if (sensorType === 'dht11') {
    const si = t.match(/^SIMA\s*(\{.+\})\s*$/);
    if (si) {
      try {
        const j = JSON.parse(si[1]);
        if (Number.isFinite(Number(j.t)) && Number.isFinite(Number(j.h))) {
          return {
            deviceId,
            sensorType: 'dht11',
            data: { temperature: Number(j.t), humidity: Number(j.h) },
          };
        }
      } catch {
        /* ignore */
      }
    }
    const hum = t.match(/Humidity:\s*([\d.-]+)\s*%/i);
    const temp = t.match(/Temperature:\s*([\d.-]+)/i);
    if (hum && temp) {
      return {
        deviceId,
        sensorType: 'dht11',
        data: { temperature: Number(temp[1]), humidity: Number(hum[1]) },
      };
    }
  }

  if (sensorType === 'soil_moisture') {
    const m = t.match(/soil(?:\s*moisture)?\s*[:=]\s*([\d.-]+)/i) || t.match(/moist(?:ure)?\s*[:=]\s*([\d.-]+)/i);
    if (m) {
      return {
        deviceId,
        sensorType: 'soil_moisture',
        data: { soilMoisture: Number(m[1]) },
      };
    }
  }

  if (sensorType === 'ultrasonic') {
    const m =
      t.match(/dist(?:ance)?\s*[:=]\s*([\d.-]+)/i) ||
      t.match(/([\d.-]+)\s*cm\b/i);
    if (m) {
      return {
        deviceId,
        sensorType: 'ultrasonic',
        data: { distanceCm: Number(m[1]) },
      };
    }
  }

  if (sensorType === 'lm35') {
    const m = t.match(/Temperature:\s*([\d.-]+)/i) || t.match(/\b[Cc]elsius\s*[:=]\s*([\d.-]+)/);
    if (m) {
      return {
        deviceId,
        sensorType: 'lm35',
        data: { temperature: Number(m[1]) },
      };
    }
  }

  if (sensorType === 'ir_sensor') {
    if (/\bIR\s*[:=]\s*(1|true|yes|detected|HIGH|on)\b/i.test(t)) {
      return { deviceId, sensorType: 'ir_sensor', data: { irDetected: true } };
    }
    if (/\bIR\s*[:=]\s*(0|false|no|clear|LOW|off)\b/i.test(t)) {
      return { deviceId, sensorType: 'ir_sensor', data: { irDetected: false } };
    }
  }

  return null;
}
