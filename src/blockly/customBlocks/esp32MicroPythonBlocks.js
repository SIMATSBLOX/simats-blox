import { fieldDigitalPin, fieldFrequencyHz } from './pinFields.js';
import { shadowText } from './valueInputShadows.js';

/** @type {import('blockly/core/utils/json').BlockDefinitionJson[]} */
export const esp32MicroPythonBlockDefinitions = [
  {
    type: 'mp_max30102_setup',
    message0: 'MAX30102 setup SDA %1 SCL %2',
    args0: [fieldDigitalPin('SDA', 21, 39), fieldDigitalPin('SCL', 22, 39)],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'esp32_blocks',
    tooltip: 'Set MAX30102 wiring pins (I2C SDA/SCL).',
  },
  {
    type: 'mp_max30102_print_raw',
    message0: 'MAX30102 print IR + BPM (burst sample)',
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'esp32_blocks',
    tooltip:
      'Runs ~50 quick FIFO reads (~1 s) so BPM can be estimated, then prints IR + BPM + AVG BPM. Press finger firmly; first beats may show 0 until the pleth stabilizes.',
  },
  {
    type: 'mp_i2c_scan',
    message0: 'I2C scan SDA %1 SCL %2',
    args0: [fieldDigitalPin('SDA', 21, 39), fieldDigitalPin('SCL', 22, 39)],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'esp32_blocks',
    tooltip: 'Scans I2C addresses on selected SDA/SCL pins and prints detected devices.',
  },
  {
    type: 'mp_neopixel_setup',
    message0: 'NeoPixel setup pin %1 count %2',
    args0: [
      fieldDigitalPin('DPIN', 18, 39),
      { type: 'field_number', name: 'COUNT', value: 8, min: 1, max: 300, precision: 1 },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'esp32_blocks',
    tooltip:
      'Blockly pin = ESP32 GPIO (must match the data wire: D18 on the board = 18, D2 = 2 — not the strip’s DI label). Code releases PWM on that pin first (GPIO18 is often VSPI clock until freed). Wire 5V + common GND; DI to strip input. If GPIO18 still dead: confirm the jumper is on the pad that is really IO18, try GPIO 4/5/12, update MicroPython, or add a 3.3V→5V level shifter on data.',
  },
  {
    type: 'mp_neopixel_fill',
    message0: 'NeoPixel fill R %1 G %2 B %3',
    args0: [
      { type: 'field_number', name: 'R', value: 255, min: 0, max: 255, precision: 1 },
      { type: 'field_number', name: 'G', value: 0, min: 0, max: 255, precision: 1 },
      { type: 'field_number', name: 'B', value: 0, min: 0, max: 255, precision: 1 },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'esp32_blocks',
    tooltip: 'Sets every pixel to the same RGB and calls np.write() (D0/DIN must already be set up).',
  },
  {
    type: 'mp_touch_read',
    message0: 'touch sensor (ESP32) on GPIO %1',
    args0: [fieldDigitalPin('DPIN', 14, 39)],
    inputsInline: true,
    output: 'Number',
    style: 'esp32_blocks',
    tooltip:
      'Use ONLY for ESP32 built-in capacitive touch pins (GPIO 4, 0, 2, 15, 13, 12, 14, 27, 33, 32).',
  },
  {
    type: 'touch_module_read',
    message0: 'touch module on GPIO %1 mode %2',
    args0: [
      fieldDigitalPin('DPIN', 4, 39),
      {
        type: 'field_dropdown',
        name: 'MODE',
        options: [
          ['NORMAL', 'NORMAL'],
          ['INVERTED', 'INVERTED'],
        ],
      },
    ],
    inputsInline: true,
    output: 'Boolean',
    style: 'esp32_blocks',
    tooltip: 'Use for external touch modules (VCC, GND, OUT). Outputs HIGH/LOW.',
  },
  {
    type: 'mp_touch_active_value',
    message0: 'touch value on GPIO %1 (0 if not touch, threshold %2)',
    args0: [
      fieldDigitalPin('DPIN', 14, 39),
      { type: 'field_number', name: 'THRESH', value: 220, min: 1, max: 2000, precision: 1 },
    ],
    inputsInline: true,
    output: 'Number',
    style: 'esp32_blocks',
    tooltip:
      'WROOM-32: raw count vs threshold (typically lower when touched). Same GPIO set as “read touch”. If always 0/-1, try GPIO 4 or 14. On ESP32-S3 use GPIO 1–14 only.',
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
      { type: 'input_value', name: 'TEXT', shadow: shadowText('Hello') },
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
