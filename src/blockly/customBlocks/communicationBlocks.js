import { shadowMathNumber, shadowText } from './valueInputShadows.js';

/** @type {import('blockly/core/utils/json').BlockDefinitionJson[]} */
export const communicationBlockDefinitions = [
  {
    type: 'comm_serial_begin',
    message0: 'start Serial (USB) at %1 baud',
    args0: [
      {
        type: 'field_number',
        name: 'BAUD',
        value: 9600,
        min: 300,
        max: 2000000,
        precision: 0,
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'comm_brown_blocks',
    tooltip: 'Call once in setup (under “when ESP32 starts” or “when board starts”). Match baud to the Serial Monitor.',
  },
  {
    type: 'comm_serial_print',
    message0: 'Serial.print %1 (no new line)',
    args0: [{ type: 'input_value', name: 'VAL', shadow: shadowMathNumber(0) }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'comm_brown_blocks',
    tooltip: 'Serial.print() — no line break; pair with println for readable lines.',
  },
  {
    type: 'comm_serial_println',
    message0: 'Serial.println %1 (new line)',
    args0: [{ type: 'input_value', name: 'VAL', shadow: shadowMathNumber(0) }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'comm_brown_blocks',
    tooltip: 'Serial.println() — adds CR/LF for Serial Monitor.',
  },
  {
    type: 'comm_bt_begin',
    message0: 'start Bluetooth as %1',
    args0: [
      {
        type: 'field_input',
        name: 'BTNAME',
        text: 'HW_BLOCK',
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'comm_brown_blocks',
    tooltip: 'BluetoothSerial device name on ESP32 (classic Bluetooth).',
  },
  {
    type: 'comm_bt_send',
    message0: 'Bluetooth.println %1',
    args0: [{ type: 'input_value', name: 'VAL', check: 'String', shadow: shadowText('Hello') }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'comm_brown_blocks',
  },
  {
    type: 'comm_bt_available',
    message0: 'Bluetooth has data to read?',
    output: 'Boolean',
    style: 'comm_brown_blocks',
    tooltip: 'True when data can be read from the Bluetooth UART (ESP32).',
  },
  {
    type: 'comm_bt_read',
    message0: 'read line from Bluetooth',
    output: 'String',
    style: 'comm_brown_blocks',
    tooltip: 'Reads a line/string from Bluetooth (ESP32).',
  },
];
