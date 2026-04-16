import { fieldAngleDeg, fieldDigitalPin, fieldMotorSpeed, fieldPwmDuty } from './pinFields.js';

/** ESP32 touch label → GPIO (typical DevKit mapping). */
const FIELD_TOUCH_PAD = {
  type: 'field_dropdown',
  name: 'TPAD',
  options: [
    ['T0', '4'],
    ['T1', '0'],
    ['T2', '2'],
    ['T3', '15'],
    ['T4', '13'],
    ['T5', '12'],
    ['T6', '14'],
    ['T7', '27'],
    ['T8', '33'],
    ['T9', '32'],
  ],
};

const FIELD_BAUD_COMMON = {
  type: 'field_dropdown',
  name: 'BAUD',
  options: [
    ['9600', '9600'],
    ['19200', '19200'],
    ['38400', '38400'],
    ['57600', '57600'],
    ['115200', '115200'],
  ],
};

const FIELD_SERIAL_PORT = {
  type: 'field_dropdown',
  name: 'SERPORT',
  options: [
    ['Serial0 (USB)', '0'],
    ['Serial1', '1'],
    ['Serial2', '2'],
  ],
};

const FIELD_BT_MODE = {
  type: 'field_dropdown',
  name: 'BTMODE',
  options: [
    ['BT Classic', 'CLASSIC'],
    ['BLE', 'BLE'],
  ],
};

const FIELD_DHT_MEASURE = {
  type: 'field_dropdown',
  name: 'DHTFIELD',
  options: [
    ['temperature', 'TEMP'],
    ['humidity', 'HUM'],
  ],
};

const FIELD_DIGITAL_SENSOR_TYPE = {
  type: 'field_dropdown',
  name: 'DSTYPE',
  options: [
    ['motion (PIR)', 'PIR'],
    ['IR obstacle / line', 'IR'],
    ['touch button', 'TOUCH'],
    ['magnetic (reed)', 'REED'],
  ],
};

const FIELD_ANALOG_SENSOR_TYPE = {
  type: 'field_dropdown',
  name: 'ASTYPE',
  options: [
    ['light / photoresistor', 'LDR'],
    ['soil moisture', 'SOIL'],
    ['gas / MQ-2', 'GAS'],
    ['rain sensor', 'RAIN'],
  ],
};

const FIELD_BMP280_MEASURE = {
  type: 'field_dropdown',
  name: 'BMPFIELD',
  options: [
    ['temperature (°C)', 'TEMP'],
    ['pressure (hPa)', 'PRESS'],
  ],
};

const FIELD_MOTOR_DIR = {
  type: 'field_dropdown',
  name: 'MDIR',
  options: [
    ['forward', 'FWD'],
    ['reverse', 'REV'],
  ],
};

const FIELD_RELAY_STATE = {
  type: 'field_dropdown',
  name: 'RELST',
  options: [
    ['ON', 'HIGH'],
    ['OFF', 'LOW'],
  ],
};

const FIELD_GAMEPAD_BTN = {
  type: 'field_dropdown',
  name: 'GPAD_BTN',
  options: [
    ['up', 'UP'],
    ['down', 'DOWN'],
    ['left', 'LEFT'],
    ['right', 'RIGHT'],
    ['A', 'A'],
    ['B', 'B'],
  ],
};

const FIELD_GAMEPAD_VAL = {
  type: 'field_dropdown',
  name: 'GPAD_VAL',
  options: [
    ['angle', 'ANGLE'],
    ['radius', 'RADIUS'],
    ['key', 'KEY'],
  ],
};

/** @type {import('blockly/core/utils/json').BlockDefinitionJson[]} */
export const mblockHardwareBlockDefinitions = [
  {
    type: 'esp32_when_starts',
    message0: 'when ESP32 starts',
    nextStatement: {},
    style: 'hat_blocks',
    tooltip: 'Hat block: stack setup code here (pin modes, serial begin, one-time setup).',
  },
  {
    type: 'mblock_wait_seconds',
    message0: 'wait %1 seconds',
    args0: [
      {
        type: 'field_number',
        name: 'SEC',
        value: 1,
        min: 0,
        max: 3600,
        precision: 1,
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'loop_blocks',
  },
  {
    type: 'mblock_stop',
    message0: 'stop %1',
    args0: [
      {
        type: 'field_dropdown',
        name: 'WHICH',
        options: [
          ['all', 'ALL'],
          ['this script', 'THIS'],
          ['other scripts in sprite', 'OTHER'],
        ],
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'loop_blocks',
    tooltip: 'Hardware IDE placeholder — no multi-sprite engine. Emits a comment in generated code.',
  },
  {
    type: 'mblock_show_variable',
    message0: 'show variable %1',
    args0: [
      {
        type: 'field_variable',
        name: 'VAR',
        variable: '%{BKY_VARIABLES_DEFAULT_NAME}',
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'variable_blocks',
    tooltip: 'Stage monitor not available in hardware mode — comment only.',
  },
  {
    type: 'mblock_hide_variable',
    message0: 'hide variable %1',
    args0: [
      {
        type: 'field_variable',
        name: 'VAR',
        variable: '%{BKY_VARIABLES_DEFAULT_NAME}',
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'variable_blocks',
  },
  {
    type: 'mblock_text_contains',
    message0: '%1 contains %2 ?',
    args0: [
      { type: 'field_input', name: 'HAY', text: 'apple' },
      { type: 'field_input', name: 'NEEDLE', text: 'a' },
    ],
    inputsInline: true,
    output: 'Boolean',
    style: 'logic_blocks',
  },
  {
    type: 'mblock_letter_of',
    message0: 'letter %1 of %2',
    args0: [
      { type: 'field_number', name: 'N', value: 1, min: 1, max: 999, precision: 0 },
      { type: 'field_input', name: 'TEXT', text: 'apple' },
    ],
    inputsInline: true,
    output: 'String',
    style: 'text_blocks',
  },
  {
    type: 'mblock_map_inline',
    message0: 'map %1 from %2 ~ %3 to %4 ~ %5',
    args0: [
      { type: 'field_number', name: 'V', value: 50, min: -32768, max: 32767, precision: 0 },
      { type: 'field_number', name: 'FL', value: 0, min: -32768, max: 32767, precision: 0 },
      { type: 'field_number', name: 'FH', value: 255, min: -32768, max: 32767, precision: 0 },
      { type: 'field_number', name: 'TL', value: 0, min: -32768, max: 32767, precision: 0 },
      { type: 'field_number', name: 'TH', value: 1023, min: -32768, max: 32767, precision: 0 },
    ],
    inputsInline: true,
    output: 'Number',
    style: 'math_blocks',
  },
  {
    type: 'esp32_digital_read_boolean',
    message0: 'digital pin %1 is HIGH?',
    args0: [fieldDigitalPin('DPIN', 2, 39)],
    inputsInline: true,
    output: 'Boolean',
    style: 'esp32_blocks',
    tooltip: 'true when the pin reads HIGH (use pinMode INPUT or INPUT_PULLUP in setup).',
  },
  {
    type: 'esp32_read_analog_pin',
    message0: 'read analog value on GPIO %1',
    args0: [fieldDigitalPin('APIN_NUM', 32, 39)],
    inputsInline: true,
    output: 'Number',
    style: 'esp32_blocks',
    tooltip: 'Raw ADC read — pick an ADC-capable GPIO on ESP32.',
  },
  {
    type: 'esp32_set_digital_out',
    message0: 'set digital pin %1 to %2',
    args0: [
      fieldDigitalPin('DPIN', 2, 39),
      {
        type: 'field_dropdown',
        name: 'LEVEL',
        options: [
          ['HIGH', 'HIGH'],
          ['LOW', 'LOW'],
        ],
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'esp32_blocks',
    tooltip: 'digitalWrite — set pin HIGH or LOW (configure pinMode OUTPUT in setup).',
  },
  {
    type: 'esp32_set_pwm_pin',
    message0: 'PWM pin %1 duty %2',
    args0: [fieldDigitalPin('DPIN', 14, 39), fieldPwmDuty(255)],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'esp32_blocks',
    tooltip: 'analogWrite / LEDC PWM — use a PWM-capable pin on your board.',
  },
  {
    type: 'esp32_touch_read_labeled',
    message0: 'touch pad %1 raw value',
    args0: [FIELD_TOUCH_PAD],
    inputsInline: true,
    output: 'Number',
    style: 'esp32_blocks',
    tooltip: 'ESP32 capacitive touch (T0–T9).',
  },
  {
    type: 'esp32_hall_value',
    message0: 'read built-in hall sensor',
    output: 'Number',
    style: 'esp32_blocks',
    tooltip: 'ESP32 hall sensor read (hallRead).',
  },
  {
    type: 'esp32_bluetooth_mac',
    message0: 'Bluetooth MAC address (text)',
    output: 'String',
    style: 'esp32_blocks',
    tooltip: 'ESP32 Wi‑Fi MAC string in preview.',
  },
  {
    type: 'mblock_motor_connect',
    message0: 'motor #%1 · IN1 pin %2 · IN2 pin %3 · PWM pin %4',
    args0: [
      fieldDigitalPin('MID', 1, 4),
      fieldDigitalPin('D1', 2, 39),
      fieldDigitalPin('D2', 4, 39),
      fieldDigitalPin('PWM', 5, 39),
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'actuator_blocks',
    tooltip: 'Sets pin modes once — wire a motor driver (L298N / DRV8833).',
  },
  {
    type: 'mblock_motor_run',
    message0: 'motor %1 · %2 · speed %3 %%',
    args0: [fieldDigitalPin('MID', 1, 4), FIELD_MOTOR_DIR, fieldMotorSpeed(100)],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'actuator_blocks',
  },
  {
    type: 'mblock_motor_free',
    message0: 'stop / coast %1 %2',
    args0: [
      {
        type: 'field_dropdown',
        name: 'KIND',
        options: [
          ['motor', 'MOTOR'],
          ['servo', 'SERVO'],
        ],
      },
      fieldDigitalPin('MID', 1, 4),
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'actuator_blocks',
  },
  {
    type: 'mblock_servo_set',
    message0: 'servo pin %1 angle %2 °',
    args0: [fieldDigitalPin('DPIN', 14, 39), fieldAngleDeg(30)],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'actuator_blocks',
  },
  {
    type: 'mblock_relay_set',
    message0: 'relay pin %1 %2',
    args0: [fieldDigitalPin('DPIN', 3, 39), FIELD_RELAY_STATE],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'actuator_blocks',
  },
  {
    type: 'sensor_ultrasonic_mblock',
    message0: 'ultrasonic distance (cm) trig %1 echo %2',
    args0: [fieldDigitalPin('TRIG', 2, 39), fieldDigitalPin('ECHO', 4, 39)],
    inputsInline: true,
    output: 'Number',
    style: 'sensor_cyan_blocks',
    tooltip: 'HC-SR04-style: pulse echo on ECHO pin; returns cm or -1 on timeout.',
  },
  {
    type: 'sensor_digital_mblock',
    message0: 'digital sensor %1 on pin %2',
    args0: [FIELD_DIGITAL_SENSOR_TYPE, fieldDigitalPin('DPIN', 2, 39)],
    inputsInline: true,
    output: 'Boolean',
    style: 'sensor_cyan_blocks',
    tooltip: 'digitalRead — add pinMode INPUT_PULLUP in setup if your sensor is active-low.',
  },
  {
    type: 'sensor_dht_mblock',
    message0: 'DHT %1 on pin %2 (%3)',
    args0: [
      FIELD_DHT_MEASURE,
      fieldDigitalPin('DPIN', 2, 39),
      {
        type: 'field_dropdown',
        name: 'TYPE',
        options: [
          ['DHT11', 'DHT11'],
          ['DHT22', 'DHT22'],
        ],
      },
    ],
    inputsInline: true,
    output: 'Number',
    style: 'sensor_cyan_blocks',
    tooltip: 'Needs DHT library in Arduino; MicroPython uses native dht module.',
  },
  {
    type: 'sensor_bmp280_mblock',
    message0: 'BMP280 I2C %1',
    args0: [FIELD_BMP280_MEASURE],
    inputsInline: true,
    output: 'Number',
    style: 'sensor_cyan_blocks',
    tooltip:
      'BMP280 over I²C (default 0x76). Preview uses a numeric placeholder — add Adafruit BMP280 (Arduino) or a bmp280 module (MicroPython) for real readings.',
  },
  {
    type: 'sensor_analog_mblock',
    message0: 'analog sensor %1 on GPIO %2',
    args0: [FIELD_ANALOG_SENSOR_TYPE, fieldDigitalPin('APIN', 32, 39)],
    inputsInline: true,
    output: 'Number',
    style: 'sensor_cyan_blocks',
    tooltip: 'Analog read on ESP32 (A0–A5 style mapping) — calibrate in your lesson.',
  },
  /* --- IoT / Dabble family (magenta) --- */
  {
    type: 'mblock_iot_create_file',
    message0: 'on phone · new %1 named %2',
    args0: [
      {
        type: 'field_dropdown',
        name: 'FTYPE',
        options: [
          ['File', 'FILE'],
          ['Directory', 'DIR'],
        ],
      },
      { type: 'field_input', name: 'FNAME', text: 'fileName' },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'dabble_blocks',
    tooltip: 'Dabble IoT panel — generated sketch uses a comment stub; wire SD/app storage yourself.',
  },
  {
    type: 'mblock_iot_log',
    message0: 'log column %1 value %2',
    args0: [
      { type: 'field_input', name: 'COL', text: 'column' },
      { type: 'field_number', name: 'VAL', value: 0, min: -32768, max: 32767, precision: 0 },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'dabble_blocks',
  },
  {
    type: 'mblock_iot_stop_logger',
    message0: 'stop phone data logger',
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'dabble_blocks',
  },
  {
    type: 'mblock_iot_notify',
    message0: 'phone notification · title %1 · message %2',
    args0: [
      { type: 'field_input', name: 'TITLE', text: 'title' },
      { type: 'field_input', name: 'MSG', text: 'message' },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'dabble_blocks',
  },
  {
    type: 'mblock_iot_clear_notify',
    message0: 'clear phone notification',
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'dabble_blocks',
  },
  {
    type: 'mblock_music_play',
    message0: 'play sound %1 · note or file %2',
    args0: [
      {
        type: 'field_dropdown',
        name: 'PLAYMODE',
        options: [
          ['play', 'PLAY'],
          ['loop', 'LOOP'],
        ],
      },
      { type: 'field_input', name: 'NOTE', text: 'C4' },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'dabble_blocks',
  },
  {
    type: 'mblock_music_stop',
    message0: 'stop music',
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'dabble_blocks',
  },
  {
    type: 'comm_bt_serial_baud',
    message0: 'set Bluetooth UART baud to %1',
    args0: [FIELD_BAUD_COMMON],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'comm_brown_blocks',
  },
  {
    type: 'comm_serial_set_pins',
    message0: 'UART %3 · TX pin %1 · RX pin %2',
    args0: [fieldDigitalPin('TX', 19, 39), fieldDigitalPin('RX', 18, 39), FIELD_SERIAL_PORT],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'comm_brown_blocks',
    tooltip: 'Comment / hook for UART routing — not all boards allow arbitrary pins.',
  },
  {
    type: 'comm_bt_configure',
    message0: 'Bluetooth %1 · device name %2',
    args0: [FIELD_BT_MODE, { type: 'field_input', name: 'BTNAME', text: 'MyEsp32' }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'comm_brown_blocks',
  },
  {
    type: 'comm_serial_baud_mblock',
    message0: '%1 baud %2',
    args0: [FIELD_SERIAL_PORT, FIELD_BAUD_COMMON],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'comm_brown_blocks',
  },
  {
    type: 'comm_serial_bytes_available',
    message0: '%1 has bytes to read?',
    args0: [FIELD_SERIAL_PORT],
    inputsInline: true,
    output: 'Boolean',
    style: 'comm_brown_blocks',
  },
  {
    type: 'comm_bt_data_available',
    message0: 'Bluetooth data waiting?',
    output: 'Boolean',
    style: 'comm_brown_blocks',
  },
  {
    type: 'comm_bt_read_bytes',
    message0: 'read string from Bluetooth',
    output: 'String',
    style: 'comm_brown_blocks',
  },
  {
    type: 'comm_bt_send_text',
    message0: 'Bluetooth send line %1',
    args0: [{ type: 'field_input', name: 'LINE', text: 'Hello World' }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'comm_brown_blocks',
  },
  {
    type: 'comm_serial_read_bytes',
    message0: 'read byte from %1',
    args0: [FIELD_SERIAL_PORT],
    inputsInline: true,
    output: 'Number',
    style: 'comm_brown_blocks',
  },
  {
    type: 'comm_serial_get_number',
    message0: 'parse number from %1',
    args0: [FIELD_SERIAL_PORT],
    inputsInline: true,
    output: 'Number',
    style: 'comm_brown_blocks',
  },
  {
    type: 'comm_serial_read_string',
    message0: 'read string from %1',
    args0: [FIELD_SERIAL_PORT],
    inputsInline: true,
    output: 'String',
    style: 'comm_brown_blocks',
  },
  {
    type: 'comm_serial_write_text',
    message0: 'print text %1 on %2',
    args0: [{ type: 'field_input', name: 'LINE', text: 'Hello World' }, FIELD_SERIAL_PORT],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'comm_brown_blocks',
  },
  /* Motor / servo enable (Dabble-style magenta) */
  {
    type: 'dabble_enable_servo',
    message0: 'Dabble · enable servo slot %1 on pin %2',
    args0: [fieldDigitalPin('SID', 1, 4), fieldDigitalPin('DPIN', 14, 39)],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'dabble_blocks',
    tooltip: 'Tells the app which pin maps to a servo; pair with Actuators → servo blocks.',
  },
  {
    type: 'dabble_enable_motor',
    message0: 'Dabble · motor %1 · IN1 %2 IN2 %3 PWM %4',
    args0: [
      fieldDigitalPin('MID', 1, 4),
      fieldDigitalPin('D1', 2, 39),
      fieldDigitalPin('D2', 4, 39),
      fieldDigitalPin('PWM', 5, 39),
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'dabble_blocks',
  },
  {
    type: 'dabble_tactile_pressed',
    message0: 'tactile button %1 pressed?',
    args0: [fieldDigitalPin('SW', 1, 4)],
    inputsInline: true,
    output: 'Boolean',
    style: 'dabble_blocks',
  },
  {
    type: 'dabble_slide_switch',
    message0: 'slide switch %1 is %2 ?',
    args0: [
      fieldDigitalPin('SW', 1, 4),
      {
        type: 'field_dropdown',
        name: 'POS',
        options: [
          ['left', 'LEFT'],
          ['right', 'RIGHT'],
        ],
      },
    ],
    inputsInline: true,
    output: 'Boolean',
    style: 'dabble_blocks',
  },
  {
    type: 'dabble_pot_value',
    message0: 'knob / slider %1 value',
    args0: [fieldDigitalPin('PID', 1, 4)],
    inputsInline: true,
    output: 'Number',
    style: 'dabble_blocks',
  },
  {
    type: 'dabble_phone_accel',
    message0: 'phone %1 (preview value)',
    args0: [
      {
        type: 'field_dropdown',
        name: 'AXIS',
        options: [
          ['accelerometer X', 'AX'],
          ['accelerometer Y', 'AY'],
          ['accelerometer Z', 'AZ'],
        ],
      },
    ],
    inputsInline: true,
    output: 'Number',
    style: 'dabble_blocks',
  },
  {
    type: 'dabble_camera_setup',
    message0: 'camera · flash %1 · quality %2 · zoom %3 %%',
    args0: [
      {
        type: 'field_dropdown',
        name: 'FLASH',
        options: [
          ['on', 'ON'],
          ['off', 'OFF'],
        ],
      },
      {
        type: 'field_dropdown',
        name: 'QUAL',
        options: [
          ['high', 'HIGH'],
          ['medium', 'MED'],
          ['low', 'LOW'],
        ],
      },
      { type: 'field_number', name: 'ZOOM', value: 0, min: 0, max: 100, precision: 0 },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'dabble_blocks',
  },
  {
    type: 'dabble_camera_rotate',
    message0: 'camera facing %1',
    args0: [
      {
        type: 'field_dropdown',
        name: 'SIDE',
        options: [
          ['rear', 'REAR'],
          ['front', 'FRONT'],
        ],
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'dabble_blocks',
  },
  {
    type: 'dabble_camera_capture',
    message0: 'camera · %1',
    args0: [
      {
        type: 'field_dropdown',
        name: 'ACT',
        options: [['Capture image', 'CAPTURE']],
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'dabble_blocks',
  },
  {
    type: 'dabble_color_grid',
    message0: 'color picker · grid %1 · mode %2 · %3',
    args0: [
      {
        type: 'field_dropdown',
        name: 'GRID',
        options: [['1x1', '1x1']],
      },
      {
        type: 'field_dropdown',
        name: 'CALC',
        options: [['dominant', 'DOM']],
      },
      {
        type: 'field_dropdown',
        name: 'SCHEME',
        options: [['24bit RGB', 'RGB24']],
      },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'dabble_blocks',
  },
  {
    type: 'dabble_color_cell',
    message0: 'cell row %2 col %3 · %1 channel',
    args0: [
      {
        type: 'field_dropdown',
        name: 'CHAN',
        options: [
          ['red', 'R'],
          ['green', 'G'],
          ['blue', 'B'],
        ],
      },
      { type: 'field_number', name: 'ROW', value: 1, min: 1, max: 16, precision: 0 },
      { type: 'field_number', name: 'COL', value: 1, min: 1, max: 16, precision: 0 },
    ],
    inputsInline: true,
    output: 'Number',
    style: 'dabble_blocks',
  },
  {
    type: 'dabble_bt_name',
    message0: 'Dabble link · Bluetooth name %1',
    args0: [{ type: 'field_input', name: 'NM', text: 'ESP32BLE' }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'dabble_blocks',
  },
  {
    type: 'dabble_refresh',
    message0: 'refresh Dabble / phone data',
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'dabble_blocks',
  },
  {
    type: 'dabble_led_control',
    message0: 'enable phone LED brightness slider',
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'dabble_blocks',
  },
  {
    type: 'dabble_terminal_has_data',
    message0: 'terminal received text %1 ?',
    args0: [{ type: 'field_input', name: 'TOK', text: 'hi' }],
    inputsInline: true,
    output: 'Boolean',
    style: 'dabble_blocks',
  },
  {
    type: 'dabble_terminal_number',
    message0: 'read number from Serial (Dabble terminal)',
    output: 'Number',
    style: 'dabble_blocks',
  },
  {
    type: 'dabble_terminal_send',
    message0: 'print %1 to Serial (Dabble sees it)',
    args0: [{ type: 'field_input', name: 'LINE', text: 'Hello!' }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'dabble_blocks',
  },
  {
    type: 'dabble_gamepad_pressed',
    message0: 'gamepad %1 pressed?',
    args0: [FIELD_GAMEPAD_BTN],
    inputsInline: true,
    output: 'Boolean',
    style: 'dabble_blocks',
  },
  {
    type: 'dabble_gamepad_value',
    message0: 'gamepad %1 value',
    args0: [FIELD_GAMEPAD_VAL],
    inputsInline: true,
    output: 'Number',
    style: 'dabble_blocks',
  },
  {
    type: 'dabble_pin_monitor',
    message0: 'show pin states in Dabble monitor',
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    style: 'dabble_blocks',
  },
];
