/** Print this from loop() after you read the DHT — one println = one Devices page update (when “Send lines to Devices” is on). */
export const ARDUINO_DHT11_PRINT_BLOCK = `Serial.print("Humidity: ");
Serial.print(h, 2);
Serial.print("%  Temperature: ");
Serial.print(t, 2);
Serial.println("°C");`;

/** Exact shape of one serial line the parser accepts for DHT11. */
export const SAMPLE_SERIAL_LINE_DHT11 = 'Humidity: 50.00%  Temperature: 25.00°C';

/**
 * @param {string} sensorType
 * @param {string} deviceId
 * @returns {{ deviceId: string, sensorType: string, data: Record<string, unknown> } | null}
 */
export function exampleReadingBodyForSensor(sensorType, deviceId) {
  const id = String(deviceId ?? '').trim();
  if (!id) return null;
  switch (sensorType) {
    case 'dht11':
      return { deviceId: id, sensorType: 'dht11', data: { temperature: 25.5, humidity: 48.0 } };
    case 'soil_moisture':
      return { deviceId: id, sensorType: 'soil_moisture', data: { soilMoisture: 420 } };
    case 'ultrasonic':
      return { deviceId: id, sensorType: 'ultrasonic', data: { distanceCm: 37.5 } };
    case 'lm35':
      return { deviceId: id, sensorType: 'lm35', data: { temperature: 31.0 } };
    case 'ir_sensor':
      return { deviceId: id, sensorType: 'ir_sensor', data: { irDetected: false } };
    default:
      return null;
  }
}

/**
 * Pretty-printed POST /api/readings body example for the given device (for docs / copy).
 * @param {string} sensorType
 * @param {string} deviceId
 * @returns {string}
 */
export function formatExampleReadingJson(sensorType, deviceId) {
  const body = exampleReadingBodyForSensor(sensorType, deviceId);
  if (!body) return '';
  return `${JSON.stringify(body, null, 2)}\n`;
}
