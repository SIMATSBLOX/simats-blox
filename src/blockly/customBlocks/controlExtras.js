import { fieldMs } from './pinFields.js';

/** Extra control blocks not covered by core Blockly library. */
/** @type {import('blockly/core/utils/json').BlockDefinitionJson[]} */
export const controlExtrasDefinitions = [
  {
    type: 'hw_wait',
    message0: 'wait %1 ms',
    args0: [fieldMs('MS', 500)],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'loop_blocks',
    tooltip: 'Pause for this many milliseconds (same as delay).',
  },
  {
    type: 'hw_wait_until',
    message0: 'wait until %1',
    args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'loop_blocks',
    tooltip: 'Spin until the condition becomes true (avoid for long waits; prefer timers in loop).',
  },
  {
    type: 'hw_forever',
    message0: 'repeat forever',
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'DO' }],
    previousStatement: null,
    nextStatement: null,
    style: 'loop_blocks',
    tooltip: 'Runs the inner stack each time loop() runs. For a tighter spin, combine with wait inside.',
  },
];
