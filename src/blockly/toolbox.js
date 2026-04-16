/** @typedef {'esp32'} BoardId */

import * as Blockly from 'blockly';

import { flyoutBlockEntry } from './toolboxFlyoutShadows.js';

/** @param {string} type */
export function isBlockRegistered(type) {
  if (!type) return false;
  try {
    if (typeof Blockly.Blocks[type] === 'object' && Blockly.Blocks[type] !== null) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function blockList(types) {
  const out = [];
  const seen = new Set();
  for (const t of types) {
    if (!t || seen.has(t)) continue;
    if (isBlockRegistered(t)) {
      seen.add(t);
      out.push(flyoutBlockEntry(t));
    }
  }
  return out;
}

/**
 * @param {string[]} preferred
 * @param {number} [minVisible]
 * @param {string[]} [extraFallbacks]
 * @param {BoardId} [boardId]
 */
function ensureVisibleBlocks(preferred, minVisible = 2, extraFallbacks = [], boardId = 'esp32') {
  const out = blockList(preferred);
  if (out.length >= minVisible) return out;
  const startHat = boardId === 'esp32' ? 'esp32_when_starts' : 'board_when_starts';
  const globalFallbacks = [
    ...extraFallbacks,
    'math_number',
    'logic_boolean',
    'controls_repeat_ext',
    startHat,
    'hw_wait',
    'variables_get',
  ];
  const have = new Set(out.map((x) => x.type));
  for (const t of globalFallbacks) {
    if (out.length >= minVisible) break;
    if (!t || have.has(t) || !isBlockRegistered(t)) continue;
    have.add(t);
    out.push(flyoutBlockEntry(t));
  }
  return out;
}

/** @param {string} label */
function section(label) {
  return { kind: 'label', text: label };
}

/** Legacy sidebar ids from older builds → new category. */
export function normalizeCategoryId(id) {
  const map = {
    board: 'esp32',
    input: 'sensors',
    output: 'actuators',
  };
  return map[id] || id;
}

const START_HAT = /** @type {const} */ ('esp32_when_starts');

/** @param {BoardId} boardId */
function esp32MicroPythonExtras() {
  return ['mp_display_i2c_setup', 'mp_display_text', 'mp_pwm_write', 'mp_touch_read'];
}

/**
 * One flyout section: heading + block types (built lazily).
 * @typedef {{ title: string, types: string[], minBlocks?: number, fallbacks?: string[] }} FlyoutSectionSpec
 */

/** @param {FlyoutSectionSpec[]} sections
 *  @param {BoardId} [_boardId]
 *  @param {{ dropEmpty?: boolean, globalMinBlocks?: number }} [opts] */
function buildSectionedFlyout(sections, _boardId = 'esp32', opts = {}) {
  const { dropEmpty = true } = opts;
  const out = [];
  const skipped = [];
  for (const { title, types, minBlocks = 0, fallbacks = [] } of sections) {
    const want = Math.max(minBlocks, types.length > 0 ? 1 : 0);
    const blocks = ensureVisibleBlocks(types, want, fallbacks, _boardId);
    for (const t of types) {
      if (!isBlockRegistered(t)) skipped.push(t);
    }
    if (dropEmpty && blocks.length === 0) continue;
    out.push(section(title));
    out.push(...blocks);
  }
  return { entries: out, skipped };
}

/** @param {string} categoryId
 *  @param {BoardId} boardId */
function flyoutForCategory(categoryId, boardId) {
  const n = normalizeCategoryId(categoryId);

  if (n === 'esp32') {
    const mp = boardId === 'esp32' ? esp32MicroPythonExtras() : [];
    return buildSectionedFlyout(
      [
        {
          title: 'Start',
          types: [START_HAT],
          minBlocks: 1,
          fallbacks: ['board_when_starts'],
        },
        {
          title: 'Pins · digital & PWM',
          types: [
            'esp32_set_digital_out',
            'esp32_digital_read_boolean',
            'esp32_set_pwm_pin',
            'esp32_read_analog_pin',
          ],
          minBlocks: 2,
          fallbacks: ['board_digital_write', 'board_digital_read'],
        },
        {
          title: 'ESP32 chip · touch & hall',
          types: ['esp32_touch_read_labeled', 'esp32_hall_value', 'esp32_bluetooth_mac'],
          minBlocks: 1,
        },
        {
          title: 'MicroPython · OLED & PWM (ESP32 board only)',
          types: mp,
          minBlocks: 0,
        },
        {
          title: 'Map a number',
          types: ['mblock_map_inline'],
          minBlocks: 0,
          fallbacks: ['math_number'],
        },
      ],
      boardId,
      { dropEmpty: true },
    );
  }

  if (n === 'control') {
    return buildSectionedFlyout(
      [
        {
          title: 'Control',
          types: [
            'mblock_wait_seconds',
            'controls_repeat',
            'controls_repeat_ext',
            'hw_forever',
            'controls_for',
            'controls_if',
            'controls_ifelse',
            'hw_wait_until',
            'controls_whileUntil',
            'controls_flow_statements',
            'hw_wait',
            'mblock_stop',
          ],
          minBlocks: 3,
        },
      ],
      boardId,
    );
  }

  if (n === 'operators') {
    return buildSectionedFlyout(
      [
        {
          title: 'Operators',
          types: [
            'text',
            'math_arithmetic',
            'math_single',
            'math_modulo',
            'math_round',
            'math_random_int',
            'logic_compare',
            'logic_operation',
            'logic_negate',
            'text_join',
            'mblock_letter_of',
            'text_length',
            'mblock_text_contains',
            'hw_map_range',
          ],
          minBlocks: 3,
        },
      ],
      boardId,
    );
  }

  if (n === 'variables') {
    const entries = [
      { kind: 'button', text: 'Make a Variable', callbackKey: 'CREATE_VARIABLE' },
      { kind: 'button', text: 'Make a List', callbackKey: 'CREATE_LIST_PLACEHOLDER' },
      { kind: 'button', text: 'Make a Table', callbackKey: 'CREATE_TABLE_PLACEHOLDER' },
      section('Variables'),
      ...ensureVisibleBlocks(
        [
          'variables_get',
          'variables_set',
          'variables_change',
          'mblock_show_variable',
          'mblock_hide_variable',
          'math_change',
        ],
        2,
        [],
        boardId,
      ),
    ];
    const skipped = [];
    return { entries, skipped };
  }

  if (n === 'myblocks') {
    const entries = [
      { kind: 'button', text: 'Make a Block', callbackKey: 'CREATE_PROCEDURE' },
      section('My Blocks'),
      ...ensureVisibleBlocks(
        ['procedures_defnoreturn', 'procedures_defreturn', 'procedures_callnoreturn', 'procedures_callreturn'],
        1,
        [],
        boardId,
      ),
    ];
    return { entries, skipped: [] };
  }

  if (n === 'actuators') {
    return buildSectionedFlyout(
      [
        {
          title: 'LED, buzzer, relay',
          types: ['output_led', 'output_buzzer_tone', 'output_buzzer_off', 'output_relay'],
          minBlocks: 2,
          fallbacks: ['board_digital_write', 'mblock_relay_set'],
        },
        {
          title: 'Servo & DC motor (one pin)',
          types: ['output_servo_write', 'output_motor_run'],
          minBlocks: 1,
          fallbacks: ['mblock_servo_set'],
        },
        {
          title: 'Motor driver (2 directions + PWM)',
          types: ['mblock_motor_connect', 'mblock_motor_run', 'mblock_motor_free'],
          minBlocks: 1,
        },
        {
          title: 'Labeled servo & relay',
          types: ['mblock_servo_set', 'mblock_relay_set'],
          minBlocks: 0,
        },
      ],
      boardId,
    );
  }

  if (n === 'sensors') {
    return buildSectionedFlyout(
      [
        {
          title: 'Distance & digital',
          types: ['sensor_ultrasonic_mblock', 'sensor_ultrasonic_cm', 'sensor_digital_mblock'],
          minBlocks: 2,
          fallbacks: ['board_digital_read'],
        },
        {
          title: 'Temperature & humidity (DHT) · BMP280',
          types: ['sensor_dht_mblock', 'sensor_dht_temp', 'sensor_dht_humidity', 'sensor_bmp280_mblock'],
          minBlocks: 1,
        },
        {
          title: 'Analog sensors',
          types: ['sensor_analog_mblock', 'sensor_ldr', 'sensor_soil', 'sensor_gas'],
          minBlocks: 2,
          fallbacks: ['board_analog_read'],
        },
      ],
      boardId,
    );
  }

  if (n === 'dabble') {
    return buildSectionedFlyout(
      [
        {
          title: 'Dabble app · link & refresh',
          types: ['dabble_bt_name', 'dabble_refresh', 'dabble_led_control', 'dabble_pin_monitor'],
          minBlocks: 1,
        },
        {
          title: 'Data logging & sound (→ comments in code)',
          types: [
            'mblock_iot_create_file',
            'mblock_iot_log',
            'mblock_iot_stop_logger',
            'mblock_iot_notify',
            'mblock_iot_clear_notify',
            'mblock_music_play',
            'mblock_music_stop',
          ],
          minBlocks: 2,
        },
        {
          title: 'On-screen controls (values are previews)',
          types: [
            'dabble_tactile_pressed',
            'dabble_slide_switch',
            'dabble_pot_value',
            'dabble_phone_accel',
          ],
          minBlocks: 2,
        },
        {
          title: 'Terminal & gamepad (values are previews)',
          types: [
            'dabble_terminal_has_data',
            'dabble_terminal_number',
            'dabble_terminal_send',
            'dabble_gamepad_pressed',
            'dabble_gamepad_value',
          ],
          minBlocks: 2,
        },
        {
          title: 'Motor / servo enable (pair with Actuators)',
          types: ['dabble_enable_motor', 'dabble_enable_servo'],
          minBlocks: 1,
        },
        {
          title: 'Camera & color (placeholders — not full camera code)',
          types: [
            'dabble_camera_setup',
            'dabble_camera_rotate',
            'dabble_camera_capture',
            'dabble_color_grid',
            'dabble_color_cell',
          ],
          minBlocks: 0,
        },
      ],
      boardId,
      { dropEmpty: true },
    );
  }

  if (n === 'communication') {
    return buildSectionedFlyout(
      [
        {
          title: 'Text — string literal (plug into Serial.print / println)',
          types: ['text'],
          minBlocks: 1,
        },
        {
          title: 'USB Serial — start here',
          types: ['comm_serial_begin', 'comm_serial_println', 'comm_serial_print'],
          minBlocks: 2,
          fallbacks: ['board_delay'],
        },
        {
          title: 'Bluetooth (on-board or module)',
          types: ['comm_bt_begin', 'comm_bt_send', 'comm_bt_available', 'comm_bt_read'],
          minBlocks: 1,
        },
        {
          title: 'Extra UART / serial ports',
          types: [
            'comm_serial_set_pins',
            'comm_serial_baud_mblock',
            'comm_serial_bytes_available',
            'comm_serial_read_bytes',
            'comm_serial_get_number',
            'comm_serial_read_string',
            'comm_serial_write_text',
          ],
          minBlocks: 1,
        },
        {
          title: 'Bluetooth (mBlock-style helpers)',
          types: [
            'comm_bt_configure',
            'comm_bt_serial_baud',
            'comm_bt_data_available',
            'comm_bt_read_bytes',
            'comm_bt_send_text',
          ],
          minBlocks: 0,
        },
      ],
      boardId,
    );
  }

  return flyoutForCategory('control', boardId);
}

/** @param {string} categoryId */
/** @param {BoardId} [boardId] */
export function getFlyoutContents(categoryId, boardId = 'esp32') {
  const n = normalizeCategoryId(categoryId);
  if (n === 'esp32' && boardId !== 'esp32') {
    return getFlyoutContents('control', boardId);
  }

  const { entries } = flyoutForCategory(n, boardId);
  let contents = entries;

  const blockCount = contents.filter((c) => c.kind === 'block').length;
  if (blockCount === 0) {
    contents = [
      section('Blocks'),
      ...ensureVisibleBlocks(['math_number', 'hw_wait', 'variables_get'], 2, [], boardId),
    ];
  }

  if (import.meta.env?.DEV) {
    const missing = contents.filter((c) => c.kind === 'block' && !isBlockRegistered(c.type)).map((c) => c.type);
    if (missing.length) {
      console.warn('[toolbox] flyout references unregistered block type(s):', [...new Set(missing)].join(', '));
    }
  }

  return contents;
}

export const CATEGORY_LIST = [
  { id: 'control', label: 'Control', hint: 'Loops, waits, if / else' },
  { id: 'operators', label: 'Operators', hint: 'Math, logic, text' },
  { id: 'variables', label: 'Variables', hint: 'Data and lists' },
  { id: 'myblocks', label: 'My Blocks', hint: 'Your procedures' },
  { id: 'esp32', label: 'ESP32', hint: 'Pins, analog, PWM, MicroPython extras' },
  { id: 'actuators', label: 'Actuators', hint: 'LED, buzzer, motors, servo, relay' },
  { id: 'sensors', label: 'Sensors', hint: 'Ultrasonic, DHT, motion, analog' },
  { id: 'dabble', label: 'Dabble', hint: 'Phone app panels (many = code hints)' },
  {
    id: 'communication',
    label: 'Communication',
    hint: 'Serial Monitor, string literals, UART, Bluetooth',
  },
];

/**
 * Category tabs (ESP32-only product).
 * @param {BoardId} [_boardId]
 */
export function getCategoryListForBoard(_boardId) {
  return CATEGORY_LIST;
}
