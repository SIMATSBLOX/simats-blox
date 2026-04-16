/**
 * Toolbox-level default shadows for core Blockly blocks.
 * Blockly does not apply `shadow` from block JSON `args0` at init; the flyout
 * `inputs` shape is what creates visible, typeable math_number / logic_boolean / text.
 */

/** @typedef {{ kind: 'block', type: string } & Record<string, unknown>} FlyoutBlockEntry */

const SH0 = { shadow: { type: 'math_number', fields: { NUM: 0 } } };
const SH1 = { shadow: { type: 'math_number', fields: { NUM: 1 } } };
const SH10 = { shadow: { type: 'math_number', fields: { NUM: 10 } } };
const SH50 = { shadow: { type: 'math_number', fields: { NUM: 50 } } };
const SH100 = { shadow: { type: 'math_number', fields: { NUM: 100 } } };
const SH255 = { shadow: { type: 'math_number', fields: { NUM: 255 } } };
const SH1023 = { shadow: { type: 'math_number', fields: { NUM: 1023 } } };
const SBTrue = { shadow: { type: 'logic_boolean', fields: { BOOL: 'TRUE' } } };
const SBFalse = { shadow: { type: 'logic_boolean', fields: { BOOL: 'FALSE' } } };
const SHello = { shadow: { type: 'text', fields: { TEXT: 'Hello' } } };

/** @type {Record<string, { inputs: Record<string, unknown> }>} */
const FLYOUT_SHADOWS = {
  math_arithmetic: { inputs: { A: SH0, B: SH0 } },
  math_single: { inputs: { NUM: SH0 } },
  math_trig: { inputs: { NUM: SH0 } },
  math_round: { inputs: { NUM: SH0 } },
  math_modulo: { inputs: { DIVIDEND: SH0, DIVISOR: SH1 } },
  math_constrain: { inputs: { VALUE: SH0, LOW: SH0, HIGH: SH100 } },
  math_random_int: { inputs: { FROM: SH1, TO: SH100 } },
  math_atan2: { inputs: { X: SH0, Y: SH0 } },
  math_change: { inputs: { DELTA: SH1 } },
  math_number_property: { inputs: { NUMBER_TO_CHECK: SH0 } },
  controls_repeat_ext: { inputs: { TIMES: SH10 } },
  controls_whileUntil: { inputs: { BOOL: SBFalse } },
  controls_for: { inputs: { FROM: SH0, TO: SH10, BY: SH1 } },
  controls_if: { inputs: { IF0: SBFalse } },
  controls_ifelse: { inputs: { IF0: SBFalse } },
  logic_compare: { inputs: { A: SH0, B: SH0 } },
  logic_operation: { inputs: { A: SBTrue, B: SBTrue } },
  logic_negate: { inputs: { BOOL: SBFalse } },
  logic_ternary: { inputs: { IF: SBFalse, THEN: SH0, ELSE: SH0 } },
  variables_set: { inputs: { VALUE: SH0 } },
  procedures_defreturn: { inputs: { RETURN: SH0 } },
  text_length: { inputs: { VALUE: SHello } },
  text_isEmpty: { inputs: { VALUE: SHello } },
  text_append: { inputs: { TEXT: SHello } },
  text_indexOf: { inputs: { VALUE: SHello, FIND: SHello } },
  hw_map_range: {
    inputs: {
      VAL: SH50,
      FROM_LOW: SH0,
      FROM_HIGH: SH255,
      TO_LOW: SH0,
      TO_HIGH: SH1023,
    },
  },
  comm_serial_print: { inputs: { VAL: SH0 } },
  comm_serial_println: { inputs: { VAL: SH0 } },
  comm_bt_send: { inputs: { VAL: SHello } },
  hw_wait_until: { inputs: { COND: SBTrue } },
  variables_change: { inputs: { DELTA: SH1 } },
  mp_display_text: { inputs: { TEXT: SHello } },
};

/**
 * @param {string} type
 * @returns {FlyoutBlockEntry}
 */
export function flyoutBlockEntry(type) {
  const extra = FLYOUT_SHADOWS[type];
  if (extra) return { kind: 'block', type, ...extra };
  return { kind: 'block', type };
}
