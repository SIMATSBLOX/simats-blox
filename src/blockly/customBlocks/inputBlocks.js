import { FIELD_ANALOG_APIN, fieldDigitalPin } from './pinFields.js';

/** @type {import('blockly/core/utils/json').BlockDefinitionJson[]} */
export const inputBlockDefinitions = [
  {
    type: 'input_button_pressed',
    message0: 'button on pin %1 is HIGH',
    args0: [fieldDigitalPin('DPIN', 2, 39)],
    inputsInline: true,
    output: 'Boolean',
    style: 'logic_blocks',
    tooltip: 'Uses digitalRead — use INPUT_PULLUP in setup if your button ties to GND when pressed.',
  },
  {
    type: 'input_potentiometer',
    message0: 'potentiometer on analog %1',
    args0: [FIELD_ANALOG_APIN],
    inputsInline: true,
    output: 'Number',
    style: 'math_blocks',
    tooltip: 'analogRead — Uno: A0–A5. ESP32: label maps to a typical ADC GPIO.',
  },
  {
    type: 'input_ir_read',
    message0: 'IR reflectance analog %1',
    args0: [FIELD_ANALOG_APIN],
    inputsInline: true,
    output: 'Number',
    style: 'math_blocks',
    tooltip: 'Analog reflectance sensor — tune thresholds in your logic.',
  },
  {
    type: 'input_pir_read',
    message0: 'PIR motion HIGH on pin %1',
    args0: [fieldDigitalPin('DPIN', 8, 39)],
    inputsInline: true,
    output: 'Boolean',
    style: 'logic_blocks',
    tooltip: 'Passive IR motion detector — digital HIGH when movement detected.',
  },
];
