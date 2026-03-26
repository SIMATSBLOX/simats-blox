import * as Blockly from 'blockly';
import { blocks as allLibraryBlocks } from 'blockly/blocks';
import * as En from 'blockly/msg/en';

import { boardBlockDefinitions } from './customBlocks/boardBlocks.js';
import { controlExtrasDefinitions } from './customBlocks/controlExtras.js';
import { operatorExtrasDefinitions } from './customBlocks/operatorExtras.js';
import { variableExtrasDefinitions } from './customBlocks/variableExtras.js';
import { inputBlockDefinitions } from './customBlocks/inputBlocks.js';
import { outputBlockDefinitions } from './customBlocks/outputBlocks.js';
import { sensorBlockDefinitions } from './customBlocks/sensorBlocks.js';
import { communicationBlockDefinitions } from './customBlocks/communicationBlocks.js';
import { esp32MicroPythonBlockDefinitions } from './customBlocks/esp32MicroPythonBlocks.js';
import { mblockHardwareBlockDefinitions } from './customBlocks/mblockHardwareBlocks.js';
import { registerTextLiteralPresentation } from './textLiteralBlockPresentation.js';

/** Register core library + custom hardware blocks (call once at startup). */
export function registerAllBlocks() {
  Blockly.setLocale(En);

  Blockly.common.defineBlocks(allLibraryBlocks);
  registerTextLiteralPresentation();

  Blockly.common.defineBlocksWithJsonArray([
    ...boardBlockDefinitions,
    ...controlExtrasDefinitions,
    ...operatorExtrasDefinitions,
    ...variableExtrasDefinitions,
    ...inputBlockDefinitions,
    ...outputBlockDefinitions,
    ...sensorBlockDefinitions,
    ...communicationBlockDefinitions,
    ...esp32MicroPythonBlockDefinitions,
    ...mblockHardwareBlockDefinitions,
  ]);
}
