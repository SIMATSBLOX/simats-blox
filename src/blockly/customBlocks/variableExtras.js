/** @type {import('blockly/core/utils/json').BlockDefinitionJson[]} */
export const variableExtrasDefinitions = [
  {
    type: 'variables_change',
    message0: 'change %1 by %2',
    args0: [
      {
        type: 'field_variable',
        name: 'VAR',
        variable: '%{BKY_VARIABLES_DEFAULT_NAME}',
      },
      { type: 'input_value', name: 'DELTA', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'variable_blocks',
    tooltip: 'Add to a variable (same idea as “change by” in Scratch).',
  },
];
