/** @type {import('blockly/core/utils/json').BlockDefinitionJson[]} */
export const operatorExtrasDefinitions = [
  {
    type: 'hw_map_range',
    message0: 'map %1 from %2 %3 to %4 %5',
    args0: [
      { type: 'input_value', name: 'VAL', check: 'Number' },
      { type: 'input_value', name: 'FROM_LOW', check: 'Number' },
      { type: 'input_value', name: 'FROM_HIGH', check: 'Number' },
      { type: 'input_value', name: 'TO_LOW', check: 'Number' },
      { type: 'input_value', name: 'TO_HIGH', check: 'Number' },
    ],
    inputsInline: true,
    output: 'Number',
    style: 'math_blocks',
    tooltip: 'Arduino map(): scales a value from one numeric range to another.',
  },
];
