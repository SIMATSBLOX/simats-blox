import {
  fieldAngleDeg,
  fieldDigitalPin,
  fieldDurationMs,
  fieldFrequencyHz,
  fieldMotorSpeed,
  fieldPwmDuty,
} from './pinFields.js';

/** @type {import('blockly/core/utils/json').BlockDefinitionJson[]} */
export const outputBlockDefinitions = [
  {
    type: 'output_led',
    message0: 'LED on pin %1 %2',
    args0: [
      fieldDigitalPin('DPIN', 13, 39),
      {
        type: 'field_dropdown',
        name: 'ON',
        options: [
          ['on', 'HIGH'],
          ['off', 'LOW'],
        ],
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'actuator_blocks',
    tooltip: 'digitalWrite — drive an LED or active-low board LED.',
  },
  {
    type: 'output_buzzer_tone',
    message0: 'buzzer pin %1 tone %2 Hz for %3 ms',
    args0: [fieldDigitalPin('DPIN', 9, 39), fieldFrequencyHz(440), fieldDurationMs(200)],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'actuator_blocks',
    tooltip: 'tone() — passive buzzer / speaker on a PWM-capable pin.',
  },
  {
    type: 'output_buzzer_off',
    message0: 'buzzer pin %1 off',
    args0: [fieldDigitalPin('DPIN', 9, 39)],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'actuator_blocks',
    tooltip: 'Stops tone() / PWM on that pin.',
  },
  {
    type: 'output_servo_write',
    message0: 'servo pin %1 angle %2 °',
    args0: [fieldDigitalPin('DPIN', 9, 39), fieldAngleDeg(90)],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'actuator_blocks',
    tooltip: 'Set servo angle (MicroPython preview uses PWM where supported).',
  },
  {
    type: 'output_motor_run',
    message0: 'DC motor PWM pin %1 speed %2',
    args0: [fieldDigitalPin('DPIN', 5, 39), fieldMotorSpeed(128)],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'actuator_blocks',
    tooltip: 'analogWrite PWM — use a motor driver board in real projects.',
  },
  {
    type: 'output_relay',
    message0: 'relay on pin %1 %2',
    args0: [
      fieldDigitalPin('DPIN', 7, 39),
      {
        type: 'field_dropdown',
        name: 'ON',
        options: [
          ['energize', 'HIGH'],
          ['de-energize', 'LOW'],
        ],
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'actuator_blocks',
    tooltip: 'Relay module — mind coil current; often active-low modules in kits.',
  },
];
