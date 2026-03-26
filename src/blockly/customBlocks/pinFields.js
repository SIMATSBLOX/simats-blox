/**
 * Reusable Blockly field definitions so hardware blocks use inline editors
 * (not empty reporter sockets) for pins and common numeric parameters.
 */

/** @param {string} name
 *  @param {number} value
 *  @param {number} [max] */
export function fieldDigitalPin(name, value, max = 39) {
  return {
    type: 'field_number',
    name,
    value,
    min: 0,
    max,
    precision: 0,
  };
}

/** Uno A0–A5 labels; generator maps to A0… or ESP32 ADC GPIO. */
export const FIELD_ANALOG_APIN = {
  type: 'field_dropdown',
  name: 'APIN',
  options: [
    ['A0', 'A0'],
    ['A1', 'A1'],
    ['A2', 'A2'],
    ['A3', 'A3'],
    ['A4', 'A4'],
    ['A5', 'A5'],
  ],
};

/** @param {string} name
 *  @param {number} value */
export function fieldMs(name, value) {
  return {
    type: 'field_number',
    name,
    value,
    min: 0,
    max: 600000,
    precision: 0,
  };
}

export function fieldPwmDuty(value = 128) {
  return {
    type: 'field_number',
    name: 'DUTY',
    value,
    min: 0,
    max: 255,
    precision: 0,
  };
}

export function fieldAngleDeg(value = 90) {
  return {
    type: 'field_number',
    name: 'ANGLE',
    value,
    min: 0,
    max: 180,
    precision: 0,
  };
}

export function fieldFrequencyHz(value = 440) {
  return {
    type: 'field_number',
    name: 'FREQ',
    value,
    min: 20,
    max: 20000,
    precision: 0,
  };
}

export function fieldDurationMs(value = 200) {
  return {
    type: 'field_number',
    name: 'DUR',
    value,
    min: 0,
    max: 60000,
    precision: 0,
  };
}

export function fieldMotorSpeed(value = 128) {
  return {
    type: 'field_number',
    name: 'SPEED',
    value,
    min: 0,
    max: 255,
    precision: 0,
  };
}
