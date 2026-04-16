/**
 * Default shadow blocks for `input_value` sockets so users see an editable field
 * immediately instead of an empty notch (Blockly flyout / new blocks).
 */

/** @param {number} [num] */
export function shadowMathNumber(num = 0) {
  return {
    type: 'math_number',
    fields: { NUM: num },
  };
}

/** @param {string} [text] */
export function shadowText(text = 'Hello') {
  return {
    type: 'text',
    fields: { TEXT: text },
  };
}

/** @param {boolean} [bool] */
export function shadowLogicBoolean(bool = true) {
  return {
    type: 'logic_boolean',
    fields: { BOOL: bool ? 'TRUE' : 'FALSE' },
  };
}
