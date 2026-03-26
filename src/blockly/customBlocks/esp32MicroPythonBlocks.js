import { fieldDigitalPin, fieldFrequencyHz } from './pinFields.js';

/** @type {import('blockly/core/utils/json').BlockDefinitionJson[]} */
export const esp32MicroPythonBlockDefinitions = [
  {
    type: 'mp_touch_read',
    message0: 'read touch on GPIO %1',
    args0: [fieldDigitalPin('DPIN', 13, 39)],
    inputsInline: true,
    output: 'Number',
    style: 'esp32_blocks',
    tooltip: 'ESP32 TouchPad.read() (MicroPython). Typical touch-capable GPIOs: 0,2,4,12,13,14,15,27,32,33.',
  },
  {
    type: 'mp_display_i2c_setup',
    message0: 'OLED I2C %1×%2 px · SCL %3 · SDA %4',
    args0: [
      { type: 'field_number', name: 'W', value: 128, min: 8, max: 256, precision: 0 },
      { type: 'field_number', name: 'H', value: 64, min: 8, max: 128, precision: 0 },
      fieldDigitalPin('SCL', 22, 39),
      fieldDigitalPin('SDA', 21, 39),
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'esp32_blocks',
    tooltip: 'SSD1306 I2C init — numeric SCL/SDA only (no reporter sockets). Run once under “when board starts”.',
  },
  {
    type: 'mp_display_text',
    message0: 'OLED show %1 at x %2 y %3',
    args0: [
      { type: 'input_value', name: 'TEXT' },
      { type: 'field_number', name: 'X', value: 0, min: 0, max: 127, precision: 0 },
      { type: 'field_number', name: 'Y', value: 0, min: 0, max: 63, precision: 0 },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'esp32_blocks',
    tooltip: 'Draws text on the OLED (requires display OLED I2C block). TEXT can be a text block or expression.',
  },
  {
    type: 'mp_pwm_write',
    message0: 'PWM %1 · %2 Hz · duty %3',
    args0: [
      fieldDigitalPin('DPIN', 22, 39),
      fieldFrequencyHz(1000),
      {
        type: 'field_number',
        name: 'DUTY',
        value: 512,
        min: 0,
        max: 1023,
        precision: 0,
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'esp32_blocks',
    tooltip: 'machine.PWM: duty 0–1023 on ESP32 MicroPython. Creates pwm{pin} once and sets duty each call.',
  },
];
