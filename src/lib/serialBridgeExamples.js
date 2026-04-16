/** Print this from loop() after you read the DHT — one println = one Devices page update (when “Send lines to Devices” is on). */
export const ARDUINO_DHT11_PRINT_BLOCK = `Serial.print("Humidity: ");
Serial.print(h, 2);
Serial.print("%  Temperature: ");
Serial.print(t, 2);
Serial.println("°C");`;

/** Exact shape of one serial line the parser accepts for DHT11 / DHT22. */
export const SAMPLE_SERIAL_LINE_DHT11 = 'Humidity: 50.0 %  Temperature: 25.0 °C';

/** Example lines matching serialReadingBridge.parseSerialLineToReading for other preset types. */
export const SAMPLE_SERIAL_LINE_ULTRASONIC = 'Distance: 37.50 cm';
export const SAMPLE_SERIAL_LINE_SOIL = 'Moisture Level: 420.0 %';
export const SAMPLE_SERIAL_LINE_LM35 = 'Temperature: 29.4 °C';
export const SAMPLE_SERIAL_LINE_IR = 'Detection: 1';
export const SAMPLE_SERIAL_LINE_PIR = 'Detection: 0';
export const SAMPLE_SERIAL_LINE_MQ2 = 'Gas level: 320';
export const SAMPLE_SERIAL_LINE_LDR = 'Light level: 512';
export const SAMPLE_SERIAL_LINE_RAIN = 'Rain level: 180';
export const SAMPLE_SERIAL_LINE_BMP280_TEMP = 'Temperature: 24.5 °C';
export const SAMPLE_SERIAL_LINE_BMP280_PRESSURE = 'Pressure: 1013.2 hPa';

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
    case 'pir':
      return { deviceId: id, sensorType: 'pir', data: { motionDetected: false } };
    case 'mq2':
      return { deviceId: id, sensorType: 'mq2', data: { gasLevel: 320 } };
    case 'ldr':
      return { deviceId: id, sensorType: 'ldr', data: { lightLevel: 512 } };
    case 'rain_sensor':
      return { deviceId: id, sensorType: 'rain_sensor', data: { rainLevel: 180 } };
    case 'bmp280':
      return {
        deviceId: id,
        sensorType: 'bmp280',
        data: { temperature: 24.5, pressure: 1013.2 },
      };
    case 'custom':
      return { deviceId: id, sensorType: 'custom', data: { reading: 42, note: 'replace with your fields' } };
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
