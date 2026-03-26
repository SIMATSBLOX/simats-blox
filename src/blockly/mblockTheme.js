import * as Blockly from 'blockly';

/**
 * mBlock / PictoBlox-inspired colours (Zelos renderer reads colourPrimary/secondary/tertiary from block style).
 */
export const mblockHardwareTheme = Blockly.Theme.defineTheme('mblockHardware', {
  base: Blockly.Themes.Classic,
  blockStyles: {
    /* Control — warm amber / yellow */
    loop_blocks: {
      colourPrimary: '#E69422',
      colourSecondary: '#CC8016',
      colourTertiary: '#B36F12',
    },
    /* Operators — math: forest green */
    math_blocks: {
      colourPrimary: '#3FA65C',
      colourSecondary: '#348A4C',
      colourTertiary: '#2B7440',
    },
    /* Operators — logic / compare: teal-green (distinct from math) */
    logic_blocks: {
      colourPrimary: '#2F9F8A',
      colourSecondary: '#268673',
      colourTertiary: '#1E6F5F',
    },
    /* Operators — text join etc. */
    text_blocks: {
      colourPrimary: '#45AC5F',
      colourSecondary: '#399150',
      colourTertiary: '#2F7A43',
    },
    /* Variables — orange (distinct from control amber) */
    variable_blocks: {
      colourPrimary: '#E8832A',
      colourSecondary: '#D07422',
      colourTertiary: '#B8651C',
    },
    variable_dynamic_blocks: {
      colourPrimary: '#E8832A',
      colourSecondary: '#D07422',
      colourTertiary: '#B8651C',
    },
    /* My Blocks — purple */
    procedure_blocks: {
      colourPrimary: '#7B68D6',
      colourSecondary: '#6858B8',
      colourTertiary: '#564A9A',
    },
    /* Board “when starts” hats — strong blue */
    hat_blocks: {
      colourPrimary: '#3582E0',
      colourSecondary: '#2D72C8',
      colourTertiary: '#2560AE',
    },
    /* ESP32 / board I/O — cyan-blue (vs hat pure blue) */
    esp32_blocks: {
      colourPrimary: '#2B9FD4',
      colourSecondary: '#248AB8',
      colourTertiary: '#1E769E',
    },
    /* Actuators — lime / bright green */
    actuator_blocks: {
      colourPrimary: '#5CCD6A',
      colourSecondary: '#4AB456',
      colourTertiary: '#3D9948',
    },
    /* Sensors */
    sensor_cyan_blocks: {
      colourPrimary: '#3EB8D6',
      colourSecondary: '#32A0BC',
      colourTertiary: '#2989A2',
    },
    /* Dabble / phone — magenta */
    dabble_blocks: {
      colourPrimary: '#C050C8',
      colourSecondary: '#A846AF',
      colourTertiary: '#923C98',
    },
    /* Serial / BT — brown–amber */
    comm_brown_blocks: {
      colourPrimary: '#9A6E42',
      colourSecondary: '#825E38',
      colourTertiary: '#6C4F30',
    },
    list_blocks: {
      colourPrimary: '#D9852A',
      colourSecondary: '#C47822',
      colourTertiary: '#AA681C',
    },
  },
  componentStyles: {
    workspaceBackgroundColour: '#1e2228',
    toolboxBackgroundColour: '#262b32',
    flyoutBackgroundColour: '#252a31',
    flyoutOpacity: 1,
    scrollbarColour: '#4a5160',
    insertionMarkerColour: '#ffffff',
    insertionMarkerOpacity: 0.35,
  },
  fontStyle: {
    family: 'Helvetica,Arial,"Helvetica Neue",sans-serif',
    weight: '600',
    size: 12,
  },
});
