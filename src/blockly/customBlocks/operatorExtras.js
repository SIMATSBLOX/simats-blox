import { shadowMathNumber } from './valueInputShadows.js';

/** @type {import('blockly/core/utils/json').BlockDefinitionJson[]} */
export const operatorExtrasDefinitions = [
  {
    type: 'hw_map_range',
    message0: 'map %1 from %2 %3 to %4 %5',
    args0: [
      { type: 'input_value', name: 'VAL', check: 'Number', shadow: shadowMathNumber(50) },
      { type: 'input_value', name: 'FROM_LOW', check: 'Number', shadow: shadowMathNumber(0) },
      { type: 'input_value', name: 'FROM_HIGH', check: 'Number', shadow: shadowMathNumber(255) },
      { type: 'input_value', name: 'TO_LOW', check: 'Number', shadow: shadowMathNumber(0) },
      { type: 'input_value', name: 'TO_HIGH', check: 'Number', shadow: shadowMathNumber(1023) },
    ],
    inputsInline: true,
    output: 'Number',
    style: 'math_blocks',
    tooltip: 'map(): scales a value from one numeric range to another.',
  },
];
