/** Keep in sync with DB check constraints / validateReadingPayload. */
export const SENSOR_TYPES = [
  'dht11',
  'lm35',
  'mq2',
  'pir',
  'ldr',
  'ultrasonic',
  'bmp280',
  'soil_moisture',
  'rain_sensor',
  'ir_sensor',
  'servo',
  /** Flat JSON object in `data` (numbers, strings, booleans only). */
  'custom',
];
