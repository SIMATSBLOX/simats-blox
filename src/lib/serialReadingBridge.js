/**
 * Parse one line of Serial Monitor output into a POST /api/readings body.
 * Uses the selected device's id + sensor type unless the line is full JSON with those fields.
 *
 * Canonical labeled lines (hardware IDE generators + examples):
 * - dht11:  Humidity: 83.0 % Temperature: 31.0 °C (merged or single println from IDE)
 * - ultrasonic: Distance: 13.36 cm
 * - lm35:     Temperature: 29.4 °C
 * - soil_moisture: Moisture: 62 % (legacy: Moisture Level: …; aliases: soil moisture:, moisture:)
 * - ir_sensor / pir: Detection: 1 | 0 (or true/false/yes/no/…)
 * - mq2: Gas level: N
 * - ldr: Light level: N
 * - rain_sensor: Rain level: N
 * - bmp280: Temperature: N °C | Pressure: N hPa (either or both)
 * - servo: Servo angle: N
 * - custom:   Light level: N | Gas level: N | IR level: N
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
        if (st === 'pir' && typeof o.motionDetected === 'boolean') {
          return {
            deviceId: did,
            sensorType: 'pir',
            data: { motionDetected: o.motionDetected },
          };
        }
        if (st === 'mq2' && Number.isFinite(Number(o.gasLevel))) {
          return {
            deviceId: did,
            sensorType: 'mq2',
            data: { gasLevel: Number(o.gasLevel) },
          };
        }
        if (st === 'ldr' && Number.isFinite(Number(o.lightLevel))) {
          return {
            deviceId: did,
            sensorType: 'ldr',
            data: { lightLevel: Number(o.lightLevel) },
          };
        }
        if (st === 'rain_sensor' && Number.isFinite(Number(o.rainLevel))) {
          return {
            deviceId: did,
            sensorType: 'rain_sensor',
            data: { rainLevel: Number(o.rainLevel) },
          };
        }
        if (st === 'bmp280') {
          const data = {};
          if (Number.isFinite(Number(o.temperature))) data.temperature = Number(o.temperature);
          if (Number.isFinite(Number(o.pressure))) data.pressure = Number(o.pressure);
          if (Object.keys(data).length) return { deviceId: did, sensorType: 'bmp280', data };
        }
        if (st === 'servo' && Number.isFinite(Number(o.angle))) {
          return {
            deviceId: did,
            sensorType: 'servo',
            data: { angle: Number(o.angle) },
          };
        }
      }
    } catch {
      /* not valid JSON */
    }
  }

  // DHT-style serial line example: Humidity: 45.00%  Temperature: 22.00°C
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
    const temp = t.match(/Temperature:\s*([\d.-]+)\s*(?:°\s*C|°C|C\b)?/i);
    if (hum && temp) {
      return {
        deviceId,
        sensorType: 'dht11',
        data: { temperature: Number(temp[1]), humidity: Number(hum[1]) },
      };
    }
  }

  if (sensorType === 'soil_moisture') {
    const m1 = t.match(/Moisture(?:\s+Level)?:\s*([\d.-]+)\s*%?/i);
    if (m1) {
      return {
        deviceId,
        sensorType: 'soil_moisture',
        data: { soilMoisture: Number(m1[1]) },
      };
    }
    const m2 = t.match(/soil(?:\s*moisture)?\s*[:=]\s*([\d.-]+)/i) || t.match(/moist(?:ure)?\s*[:=]\s*([\d.-]+)/i);
    if (m2) {
      return {
        deviceId,
        sensorType: 'soil_moisture',
        data: { soilMoisture: Number(m2[1]) },
      };
    }
  }

  if (sensorType === 'ultrasonic') {
    const primary = t.match(/Distance:\s*([\d.-]+)\s*cm\b/i);
    if (primary) {
      return {
        deviceId,
        sensorType: 'ultrasonic',
        data: { distanceCm: Number(primary[1]) },
      };
    }
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
    const m =
      t.match(/Temperature:\s*([\d.-]+)\s*(?:°\s*C|°C|C\b)?/i) ||
      t.match(/\bLM35\s*[:=]\s*([\d.-]+)\s*(?:°\s*C|°C)?/i) ||
      t.match(/\bcelsius\s*[:=]\s*([\d.-]+)/i);
    if (m) {
      return {
        deviceId,
        sensorType: 'lm35',
        data: { temperature: Number(m[1]) },
      };
    }
  }

  if (sensorType === 'ir_sensor') {
    const det = t.match(/Detection:\s*(0|1|true|false|yes|no|high|low|on|off|detected|clear)\b/i);
    if (det) {
      const v = det[1].toLowerCase();
      const detected = v === '0' || v === 'true' || v === 'yes' || v === 'low' || v === 'on' || v === 'detected';
      return { deviceId, sensorType: 'ir_sensor', data: { irDetected: detected } };
    }
    if (/\bIR\s*[:=]\s*(0|true|yes|detected|LOW|on)\b/i.test(t)) {
      return { deviceId, sensorType: 'ir_sensor', data: { irDetected: true } };
    }
    if (/\bIR\s*[:=]\s*(1|false|no|clear|HIGH|off)\b/i.test(t)) {
      return { deviceId, sensorType: 'ir_sensor', data: { irDetected: false } };
    }
  }

  if (sensorType === 'pir') {
    const det = t.match(/Detection:\s*(0|1|true|false|yes|no|high|low|on|off|detected|clear)\b/i);
    if (det) {
      const v = det[1].toLowerCase();
      const on = v === '1' || v === 'true' || v === 'yes' || v === 'high' || v === 'on' || v === 'detected';
      return { deviceId, sensorType: 'pir', data: { motionDetected: on } };
    }
  }

  if (sensorType === 'mq2') {
    const gas = t.match(/Gas\s*level:\s*([\d.-]+)/i);
    if (gas) {
      return { deviceId, sensorType: 'mq2', data: { gasLevel: Number(gas[1]) } };
    }
  }

  if (sensorType === 'ldr') {
    const light = t.match(/Light\s*level:\s*([\d.-]+)/i);
    if (light) {
      return { deviceId, sensorType: 'ldr', data: { lightLevel: Number(light[1]) } };
    }
  }

  if (sensorType === 'rain_sensor') {
    const rain = t.match(/Rain\s*level:\s*([\d.-]+)/i);
    if (rain) {
      return { deviceId, sensorType: 'rain_sensor', data: { rainLevel: Number(rain[1]) } };
    }
  }

  if (sensorType === 'bmp280') {
    const data = {};
    const temp = t.match(/Temperature:\s*([\d.-]+)\s*(?:°\s*C|°C|C\b)?/i);
    const press = t.match(/Pressure:\s*([\d.-]+)\s*hPa\b/i);
    if (temp) data.temperature = Number(temp[1]);
    if (press) data.pressure = Number(press[1]);
    if (Object.keys(data).length) {
      return { deviceId, sensorType: 'bmp280', data };
    }
  }

  if (sensorType === 'servo') {
    const a = t.match(/Servo\\s*angle\\s*:\\s*([\\d.-]+)/i) || t.match(/\\bangle\\s*[:=]\\s*([\\d.-]+)/i);
    if (a) {
      return { deviceId, sensorType: 'servo', data: { angle: Number(a[1]) } };
    }
  }

  if (sensorType === 'custom') {
    const light = t.match(/Light\s*level:\s*([\d.-]+)/i);
    if (light) {
      return { deviceId, sensorType: 'custom', data: { lightLevel: Number(light[1]) } };
    }
    const gas = t.match(/Gas\s*level:\s*([\d.-]+)/i);
    if (gas) {
      return { deviceId, sensorType: 'custom', data: { gasLevel: Number(gas[1]) } };
    }
    const irl = t.match(/IR\s*level:\s*([\d.-]+)/i);
    if (irl) {
      return { deviceId, sensorType: 'custom', data: { irLevel: Number(irl[1]) } };
    }
  }

  return null;
}
