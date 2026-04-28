import { FIELD_ANALOG_APIN, fieldDigitalPin } from './pinFields.js';

/** @type {import('blockly/core/utils/json').BlockDefinitionJson[]} */
export const sensorBlockDefinitions = [
  {
    type: 'sensor_ultrasonic_cm',
    message0: 'HC-SR04 distance (cm) trig %1 echo %2',
    args0: [fieldDigitalPin('TRIG', 12, 39), fieldDigitalPin('ECHO', 11, 39)],
    inputsInline: true,
    output: 'Number',
    style: 'sensor_cyan_blocks',
    tooltip: 'Ultrasonic distance; returns cm or -1 on timeout (MicroPython preview).',
  },
  {
    type: 'sensor_dht_temp',
    message0: 'DHT temperature (°C) pin %1 %2',
    args0: [
      fieldDigitalPin('DPIN', 2, 39),
      {
        type: 'field_dropdown',
        name: 'TYPE',
        options: [
          ['DHT11', 'DHT11'],
          ['DHT22', 'DHT22'],
        ],
      },
    ],
    inputsInline: true,
    output: 'Number',
    style: 'sensor_cyan_blocks',
    tooltip: 'DHT on ESP32 — MicroPython preview uses the native dht module; allow time between reads.',
  },
  {
    type: 'sensor_dht_humidity',
    message0: 'DHT humidity (%) pin %1 %2',
    args0: [
      fieldDigitalPin('DPIN', 2, 39),
      {
        type: 'field_dropdown',
        name: 'TYPE',
        options: [
          ['DHT11', 'DHT11'],
          ['DHT22', 'DHT22'],
        ],
      },
    ],
    inputsInline: true,
    output: 'Number',
    style: 'sensor_cyan_blocks',
    tooltip: 'Same DHT wiring as temperature; MicroPython uses the built-in dht module.',
  },
  {
    type: 'sensor_ldr',
    message0: 'light sensor (LDR) %1',
    args0: [FIELD_ANALOG_APIN],
    inputsInline: true,
    output: 'Number',
    style: 'sensor_cyan_blocks',
    tooltip: 'Voltage divider with LDR — higher often means more light (depends on wiring).',
  },
  {
    type: 'sensor_soil',
    message0: 'soil moisture %1',
    args0: [FIELD_ANALOG_APIN],
    inputsInline: true,
    output: 'Number',
    style: 'sensor_cyan_blocks',
    tooltip: 'Capacitive soil probe — calibrate wet/dry thresholds in your sketch.',
  },
  {
    type: 'sensor_gas',
    message0: 'gas sensor (MQ) %1',
    args0: [FIELD_ANALOG_APIN],
    inputsInline: true,
    output: 'Number',
    style: 'sensor_cyan_blocks',
    tooltip: 'MQ-style gas sensor analog output — calibrate for your module and gas.',
  },
];
