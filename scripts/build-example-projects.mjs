/**
 * Regenerates public/examples/*.json from Blockly (run: node scripts/build-example-projects.mjs).
 * Also writes public/examples/index.json — do not edit index.json by hand.
 */
import * as Blockly from 'blockly';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerAllBlocks } from '../src/blockly/registerBlocks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const examplesDir = path.join(root, 'public', 'examples');

registerAllBlocks();

function savePayload(name, boardId, description, ws) {
  return {
    version: 1,
    projectName: name,
    boardId,
    description,
    blockly: Blockly.serialization.workspaces.save(ws),
  };
}

function writeExample(filename, payload) {
  fs.mkdirSync(examplesDir, { recursive: true });
  fs.writeFileSync(path.join(examplesDir, filename), JSON.stringify(payload, null, 2), 'utf8');
}

/** @type {{ file: string, label: string, boardId: 'arduino_uno' | 'esp32' }[]} */
const MANIFEST = [];

function addManifest(file, label, boardId) {
  MANIFEST.push({ file, label, boardId });
}

// --- Arduino Uno (9) — hat: board_when_starts ---

// 1 Blink LED
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('board_when_starts');
  const pm = ws.newBlock('board_pin_mode');
  pm.setFieldValue('OUTPUT', 'MODE');
  pm.setFieldValue(13, 'DPIN');
  const forever = ws.newBlock('hw_forever');
  const wHigh = ws.newBlock('board_digital_write');
  wHigh.setFieldValue(13, 'DPIN');
  wHigh.setFieldValue('HIGH', 'LEVEL');
  const d1 = ws.newBlock('board_delay');
  d1.setFieldValue(500, 'MS');
  const wLow = ws.newBlock('board_digital_write');
  wLow.setFieldValue(13, 'DPIN');
  wLow.setFieldValue('LOW', 'LEVEL');
  const d2 = ws.newBlock('board_delay');
  d2.setFieldValue(500, 'MS');
  hat.nextConnection.connect(pm.previousConnection);
  pm.nextConnection.connect(forever.previousConnection);
  const stmtIn = forever.getInput('DO').connection;
  stmtIn.connect(wHigh.previousConnection);
  wHigh.nextConnection.connect(d1.previousConnection);
  d1.nextConnection.connect(wLow.previousConnection);
  wLow.nextConnection.connect(d2.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'blink-led-uno.json',
    savePayload(
      'Example: Blink LED',
      'arduino_uno',
      'Built-in LED on pin 13 toggles every 500 ms (delay). Match Serial Monitor to 9600 baud if you add prints later.',
      ws,
    ),
  );
  addManifest('blink-led-uno.json', 'Blink LED', 'arduino_uno');
  ws.dispose();
}

// 2 Serial / Serial Monitor (basic)
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('board_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(9600, 'BAUD');
  const forever = ws.newBlock('hw_forever');
  const println = ws.newBlock('comm_serial_println');
  const msg = ws.newBlock('text');
  msg.setFieldValue('Hello from Uno', 'TEXT');
  println.getInput('VAL').connection.connect(msg.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(1000, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'serial-basic-uno.json',
    savePayload(
      'Example: Serial Monitor (basic)',
      'arduino_uno',
      'Opens Serial at 9600 baud and prints a line every 1 s. Open the IDE Serial Monitor at 9600 to see output.',
      ws,
    ),
  );
  addManifest('serial-basic-uno.json', 'Serial Monitor (basic)', 'arduino_uno');
  ws.dispose();
}

// 3 Ultrasonic distance
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('board_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  const forever = ws.newBlock('hw_forever');
  const println = ws.newBlock('comm_serial_println');
  const ultra = ws.newBlock('sensor_ultrasonic_mblock');
  ultra.setFieldValue(2, 'TRIG');
  ultra.setFieldValue(4, 'ECHO');
  println.getInput('VAL').connection.connect(ultra.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(500, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'ultrasonic-monitor-uno.json',
    savePayload(
      'Example: Ultrasonic distance',
      'arduino_uno',
      'HC-SR04-style sensor: TRIG 2, ECHO 4. Prints distance (cm) every 500 ms. Uses the same ultrasonic block family as the toolbox.',
      ws,
    ),
  );
  addManifest('ultrasonic-monitor-uno.json', 'Ultrasonic distance', 'arduino_uno');
  ws.dispose();
}

// 4 DHT11 temperature & humidity
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('board_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  const forever = ws.newBlock('hw_forever');
  const p1 = ws.newBlock('comm_serial_println');
  const dhtT = ws.newBlock('sensor_dht_mblock');
  dhtT.setFieldValue('TEMP', 'DHTFIELD');
  dhtT.setFieldValue(2, 'DPIN');
  dhtT.setFieldValue('DHT11', 'TYPE');
  p1.getInput('VAL').connection.connect(dhtT.outputConnection);
  const p2 = ws.newBlock('comm_serial_println');
  const dhtH = ws.newBlock('sensor_dht_mblock');
  dhtH.setFieldValue('HUM', 'DHTFIELD');
  dhtH.setFieldValue(2, 'DPIN');
  dhtH.setFieldValue('DHT11', 'TYPE');
  p2.getInput('VAL').connection.connect(dhtH.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(2000, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(forever.previousConnection);
  const st = forever.getInput('DO').connection;
  st.connect(p1.previousConnection);
  p1.nextConnection.connect(p2.previousConnection);
  p2.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'dht-temp-humidity-uno.json',
    savePayload(
      'Example: DHT11 temperature & humidity',
      'arduino_uno',
      'DHT11 data pin on digital 2. Install a DHT library (e.g. Adafruit DHT) for a real upload; preview shows generated calls. Prints temp then humidity every 2 s.',
      ws,
    ),
  );
  addManifest('dht-temp-humidity-uno.json', 'DHT11 temp & humidity', 'arduino_uno');
  ws.dispose();
}

// 5 Servo sweep
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('board_when_starts');
  const forever = ws.newBlock('hw_forever');
  const s0 = ws.newBlock('output_servo_write');
  s0.setFieldValue(9, 'DPIN');
  s0.setFieldValue(0, 'ANGLE');
  const w0 = ws.newBlock('hw_wait');
  w0.setFieldValue(800, 'MS');
  const s90 = ws.newBlock('output_servo_write');
  s90.setFieldValue(9, 'DPIN');
  s90.setFieldValue(90, 'ANGLE');
  const w1 = ws.newBlock('hw_wait');
  w1.setFieldValue(800, 'MS');
  const s180 = ws.newBlock('output_servo_write');
  s180.setFieldValue(9, 'DPIN');
  s180.setFieldValue(180, 'ANGLE');
  const w2 = ws.newBlock('hw_wait');
  w2.setFieldValue(800, 'MS');
  hat.nextConnection.connect(forever.previousConnection);
  const st = forever.getInput('DO').connection;
  st.connect(s0.previousConnection);
  s0.nextConnection.connect(w0.previousConnection);
  w0.nextConnection.connect(s90.previousConnection);
  s90.nextConnection.connect(w1.previousConnection);
  w1.nextConnection.connect(s180.previousConnection);
  s180.nextConnection.connect(w2.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'servo-sweep-uno.json',
    savePayload(
      'Example: Servo sweep',
      'arduino_uno',
      'Standard servo signal on pin 9: 0° → 90° → 180° with pauses. Preview uses Servo.h-style helper code.',
      ws,
    ),
  );
  addManifest('servo-sweep-uno.json', 'Servo sweep', 'arduino_uno');
  ws.dispose();
}

// 6 DC motor (L298N-style driver)
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('board_when_starts');
  const conn = ws.newBlock('mblock_motor_connect');
  conn.setFieldValue(1, 'MID');
  conn.setFieldValue(2, 'D1');
  conn.setFieldValue(4, 'D2');
  conn.setFieldValue(5, 'PWM');
  const forever = ws.newBlock('hw_forever');
  const run = ws.newBlock('mblock_motor_run');
  run.setFieldValue(1, 'MID');
  run.setFieldValue('FWD', 'MDIR');
  run.setFieldValue(120, 'SPEED');
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(2000, 'MS');
  hat.nextConnection.connect(conn.previousConnection);
  conn.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(run.previousConnection);
  run.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'motor-l298n-uno.json',
    savePayload(
      'Example: DC motor (L298N-style)',
      'arduino_uno',
      'Motor #1: IN1=2, IN2=4, PWM/ENA=5 (typical L298N wiring). Runs forward at ~120 PWM, 2 s per loop. Use PWM-capable pin for ENA on Uno (e.g. 5).',
      ws,
    ),
  );
  addManifest('motor-l298n-uno.json', 'DC motor (L298N-style)', 'arduino_uno');
  ws.dispose();
}

// 7 LM35 analog temperature (raw ADC)
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('board_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  const forever = ws.newBlock('hw_forever');
  const printLabel = ws.newBlock('comm_serial_print');
  const labelText = ws.newBlock('text');
  labelText.setFieldValue('LM35 raw: ', 'TEXT');
  printLabel.getInput('VAL').connection.connect(labelText.outputConnection);
  const println = ws.newBlock('comm_serial_println');
  const adc = ws.newBlock('board_analog_read');
  adc.setFieldValue('A0', 'APIN');
  println.getInput('VAL').connection.connect(adc.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(500, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(forever.previousConnection);
  const stmtIn = forever.getInput('DO').connection;
  stmtIn.connect(printLabel.previousConnection);
  printLabel.nextConnection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'lm35-uno.json',
    savePayload(
      'Example: LM35 temperature (raw ADC)',
      'arduino_uno',
      'LM35 Vout → analog pin A0. Prints 0–1023 raw analogRead every 500 ms. In class: convert to voltage then °C (≈ 10 mV/°C for classic LM35).',
      ws,
    ),
  );
  addManifest('lm35-uno.json', 'LM35 (analog)', 'arduino_uno');
  ws.dispose();
}

// 8 Digital line / obstacle sensor (IR-style)
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('board_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  const pm = ws.newBlock('board_pin_mode');
  pm.setFieldValue(8, 'DPIN');
  pm.setFieldValue('INPUT_PULLUP', 'MODE');
  const forever = ws.newBlock('hw_forever');
  const printLabel = ws.newBlock('comm_serial_print');
  const labelText = ws.newBlock('text');
  labelText.setFieldValue('Line/obstacle (HIGH=1): ', 'TEXT');
  printLabel.getInput('VAL').connection.connect(labelText.outputConnection);
  const println = ws.newBlock('comm_serial_println');
  const dig = ws.newBlock('sensor_digital_mblock');
  dig.setFieldValue('PIR', 'DSTYPE');
  dig.setFieldValue(8, 'DPIN');
  println.getInput('VAL').connection.connect(dig.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(300, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(pm.previousConnection);
  pm.nextConnection.connect(forever.previousConnection);
  const stmtIn = forever.getInput('DO').connection;
  stmtIn.connect(printLabel.previousConnection);
  printLabel.nextConnection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'ir-sensor-uno.json',
    savePayload(
      'Example: IR / line sensor (digital)',
      'arduino_uno',
      'Many IR obstacle or line modules are open-collector / active-low; this sketch uses pin 8 with INPUT_PULLUP and prints True/False (True = pin reads HIGH). Adjust pin and polarity for your module.',
      ws,
    ),
  );
  addManifest('ir-sensor-uno.json', 'IR / line sensor (digital)', 'arduino_uno');
  ws.dispose();
}

// 9 Soil moisture (analog)
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('board_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  const forever = ws.newBlock('hw_forever');
  const printLabel = ws.newBlock('comm_serial_print');
  const labelText = ws.newBlock('text');
  labelText.setFieldValue('Soil moisture raw: ', 'TEXT');
  printLabel.getInput('VAL').connection.connect(labelText.outputConnection);
  const println = ws.newBlock('comm_serial_println');
  const soil = ws.newBlock('sensor_analog_mblock');
  soil.setFieldValue('SOIL', 'ASTYPE');
  soil.setFieldValue(0, 'APIN');
  println.getInput('VAL').connection.connect(soil.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(1000, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(forever.previousConnection);
  const stmtIn = forever.getInput('DO').connection;
  stmtIn.connect(printLabel.previousConnection);
  printLabel.nextConnection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'soil-moisture-uno.json',
    savePayload(
      'Example: Soil moisture (analog)',
      'arduino_uno',
      'FC-28-style analog output → Uno A0 (block APIN 0 maps to A0). Prints raw 0–1023 every 1 s; calibrate dry vs wet in your lesson.',
      ws,
    ),
  );
  addManifest('soil-moisture-uno.json', 'Soil moisture (analog)', 'arduino_uno');
  ws.dispose();
}

// --- ESP32 MicroPython (9) — hat: esp32_when_starts ---

// 1 Blink LED
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const pm = ws.newBlock('board_pin_mode');
  pm.setFieldValue('OUTPUT', 'MODE');
  pm.setFieldValue(2, 'DPIN');
  const forever = ws.newBlock('hw_forever');
  const wHigh = ws.newBlock('board_digital_write');
  wHigh.setFieldValue(2, 'DPIN');
  wHigh.setFieldValue('HIGH', 'LEVEL');
  const d1 = ws.newBlock('hw_wait');
  d1.setFieldValue(500, 'MS');
  const wLow = ws.newBlock('board_digital_write');
  wLow.setFieldValue(2, 'DPIN');
  wLow.setFieldValue('LOW', 'LEVEL');
  const d2 = ws.newBlock('hw_wait');
  d2.setFieldValue(500, 'MS');
  hat.nextConnection.connect(pm.previousConnection);
  pm.nextConnection.connect(forever.previousConnection);
  const stmtIn = forever.getInput('DO').connection;
  stmtIn.connect(wHigh.previousConnection);
  wHigh.nextConnection.connect(d1.previousConnection);
  d1.nextConnection.connect(wLow.previousConnection);
  wLow.nextConnection.connect(d2.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'blink-led-esp32.json',
    savePayload(
      'Example: Blink LED',
      'esp32',
      'Toggles GPIO2 HIGH/LOW every 500 ms (many DevKit boards use GPIO2 for the onboard LED; use another pin if yours differs). MicroPython preview.',
      ws,
    ),
  );
  addManifest('blink-led-esp32.json', 'Blink LED', 'esp32');
  ws.dispose();
}

// 2 Serial / REPL-style prints (basic)
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const forever = ws.newBlock('hw_forever');
  const println = ws.newBlock('comm_serial_println');
  const msg = ws.newBlock('text');
  msg.setFieldValue('Hello from ESP32', 'TEXT');
  println.getInput('VAL').connection.connect(msg.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(1000, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'serial-basic-esp32.json',
    savePayload(
      'Example: Serial / print (basic)',
      'esp32',
      'MicroPython preview uses print() in the loop. Thonny/REPL or serial at 115200 baud. The serial-begin block is a teaching marker in preview.',
      ws,
    ),
  );
  addManifest('serial-basic-esp32.json', 'Serial / print (basic)', 'esp32');
  ws.dispose();
}

// 3 Ultrasonic distance
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const forever = ws.newBlock('hw_forever');
  const println = ws.newBlock('comm_serial_println');
  const ultra = ws.newBlock('sensor_ultrasonic_mblock');
  ultra.setFieldValue(5, 'TRIG');
  ultra.setFieldValue(18, 'ECHO');
  println.getInput('VAL').connection.connect(ultra.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(500, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'ultrasonic-esp32.json',
    savePayload(
      'Example: Ultrasonic distance',
      'esp32',
      'HC-SR04-style: TRIG GPIO5, ECHO GPIO18 (3.3 V safe levels — use a level shifter if your module is 5 V only). Prints cm every 500 ms.',
      ws,
    ),
  );
  addManifest('ultrasonic-esp32.json', 'Ultrasonic distance', 'esp32');
  ws.dispose();
}

// 4 DHT22 temperature & humidity
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const forever = ws.newBlock('hw_forever');
  const p1 = ws.newBlock('comm_serial_println');
  const dhtT = ws.newBlock('sensor_dht_mblock');
  dhtT.setFieldValue('TEMP', 'DHTFIELD');
  dhtT.setFieldValue(15, 'DPIN');
  dhtT.setFieldValue('DHT22', 'TYPE');
  p1.getInput('VAL').connection.connect(dhtT.outputConnection);
  const p2 = ws.newBlock('comm_serial_println');
  const dhtH = ws.newBlock('sensor_dht_mblock');
  dhtH.setFieldValue('HUM', 'DHTFIELD');
  dhtH.setFieldValue(15, 'DPIN');
  dhtH.setFieldValue('DHT22', 'TYPE');
  p2.getInput('VAL').connection.connect(dhtH.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(2000, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(forever.previousConnection);
  const st = forever.getInput('DO').connection;
  st.connect(p1.previousConnection);
  p1.nextConnection.connect(p2.previousConnection);
  p2.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'dht-temp-humidity-esp32.json',
    savePayload(
      'Example: DHT22 temperature & humidity',
      'esp32',
      'DHT22 on GPIO15. Preview uses the machine/dht-style helpers. Allow 2 s between reads. Change the pin in blocks if your wiring differs.',
      ws,
    ),
  );
  addManifest('dht-temp-humidity-esp32.json', 'DHT22 temp & humidity', 'esp32');
  ws.dispose();
}

// 5 Servo sweep
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const forever = ws.newBlock('hw_forever');
  const s0 = ws.newBlock('output_servo_write');
  s0.setFieldValue(18, 'DPIN');
  s0.setFieldValue(0, 'ANGLE');
  const w0 = ws.newBlock('hw_wait');
  w0.setFieldValue(800, 'MS');
  const s90 = ws.newBlock('output_servo_write');
  s90.setFieldValue(18, 'DPIN');
  s90.setFieldValue(90, 'ANGLE');
  const w1 = ws.newBlock('hw_wait');
  w1.setFieldValue(800, 'MS');
  const s180 = ws.newBlock('output_servo_write');
  s180.setFieldValue(18, 'DPIN');
  s180.setFieldValue(180, 'ANGLE');
  const w2 = ws.newBlock('hw_wait');
  w2.setFieldValue(800, 'MS');
  hat.nextConnection.connect(forever.previousConnection);
  const st = forever.getInput('DO').connection;
  st.connect(s0.previousConnection);
  s0.nextConnection.connect(w0.previousConnection);
  w0.nextConnection.connect(s90.previousConnection);
  s90.nextConnection.connect(w1.previousConnection);
  w1.nextConnection.connect(s180.previousConnection);
  s180.nextConnection.connect(w2.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'servo-sweep-esp32.json',
    savePayload(
      'Example: Servo sweep',
      'esp32',
      'Angles 0° / 90° / 180° on GPIO18. MicroPython preview currently emits a short PWM teaching comment per write — use calibrated pulse widths on real hardware.',
      ws,
    ),
  );
  addManifest('servo-sweep-esp32.json', 'Servo sweep', 'esp32');
  ws.dispose();
}

// 6 DC motor (L298N-style driver)
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const conn = ws.newBlock('mblock_motor_connect');
  conn.setFieldValue(1, 'MID');
  conn.setFieldValue(2, 'D1');
  conn.setFieldValue(4, 'D2');
  conn.setFieldValue(5, 'PWM');
  const forever = ws.newBlock('hw_forever');
  const run = ws.newBlock('mblock_motor_run');
  run.setFieldValue(1, 'MID');
  run.setFieldValue('FWD', 'MDIR');
  run.setFieldValue(120, 'SPEED');
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(2000, 'MS');
  hat.nextConnection.connect(conn.previousConnection);
  conn.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(run.previousConnection);
  run.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'motor-l298n-esp32.json',
    savePayload(
      'Example: DC motor (L298N-style)',
      'esp32',
      'Motor #1: IN1=2, IN2=4, PWM=5. Runs forward at PWM 120, 2 s per loop. MicroPython preview sets pin directions and PWM duty; verify GPIOs match your driver.',
      ws,
    ),
  );
  addManifest('motor-l298n-esp32.json', 'DC motor (L298N-style)', 'esp32');
  ws.dispose();
}

// 7 LM35 (raw ADC on GPIO34)
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const forever = ws.newBlock('hw_forever');
  const printLabel = ws.newBlock('comm_serial_print');
  const labelText = ws.newBlock('text');
  labelText.setFieldValue('LM35 raw: ', 'TEXT');
  printLabel.getInput('VAL').connection.connect(labelText.outputConnection);
  const println = ws.newBlock('comm_serial_println');
  const adc = ws.newBlock('esp32_read_analog_pin');
  adc.setFieldValue(34, 'APIN_NUM');
  println.getInput('VAL').connection.connect(adc.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(500, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(forever.previousConnection);
  const stmtIn = forever.getInput('DO').connection;
  stmtIn.connect(printLabel.previousConnection);
  printLabel.nextConnection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'lm35-esp32.json',
    savePayload(
      'Example: LM35 temperature (raw ADC)',
      'esp32',
      'LM35 analog out → GPIO34 (ADC1, input-only on many DevKit boards). Serial 115200: labeled raw read every 500 ms. Convert to °C in your lesson (≈ 10 mV/°C for classic LM35 at 3.3 V ref).',
      ws,
    ),
  );
  addManifest('lm35-esp32.json', 'LM35 (analog)', 'esp32');
  ws.dispose();
}

// 8 IR / line sensor (digital)
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const pm = ws.newBlock('board_pin_mode');
  pm.setFieldValue(14, 'DPIN');
  pm.setFieldValue('INPUT_PULLUP', 'MODE');
  const forever = ws.newBlock('hw_forever');
  const printLabel = ws.newBlock('comm_serial_print');
  const labelText = ws.newBlock('text');
  labelText.setFieldValue('IR / line (bool): ', 'TEXT');
  printLabel.getInput('VAL').connection.connect(labelText.outputConnection);
  const println = ws.newBlock('comm_serial_println');
  const dig = ws.newBlock('sensor_digital_mblock');
  dig.setFieldValue('PIR', 'DSTYPE');
  dig.setFieldValue(14, 'DPIN');
  println.getInput('VAL').connection.connect(dig.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(300, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(pm.previousConnection);
  pm.nextConnection.connect(forever.previousConnection);
  const stmtIn = forever.getInput('DO').connection;
  stmtIn.connect(printLabel.previousConnection);
  printLabel.nextConnection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'ir-sensor-esp32.json',
    savePayload(
      'Example: IR / line sensor (digital)',
      'esp32',
      'GPIO14 with internal pull-up; digital sensor block prints True when the pin reads high. Many IR modules are active-low—invert logic in your lesson if needed.',
      ws,
    ),
  );
  addManifest('ir-sensor-esp32.json', 'IR / line sensor (digital)', 'esp32');
  ws.dispose();
}

// 9 Soil moisture (analog)
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const forever = ws.newBlock('hw_forever');
  const printLabel = ws.newBlock('comm_serial_print');
  const labelText = ws.newBlock('text');
  labelText.setFieldValue('Soil moisture raw: ', 'TEXT');
  printLabel.getInput('VAL').connection.connect(labelText.outputConnection);
  const println = ws.newBlock('comm_serial_println');
  const soil = ws.newBlock('sensor_analog_mblock');
  soil.setFieldValue('SOIL', 'ASTYPE');
  soil.setFieldValue(34, 'APIN');
  println.getInput('VAL').connection.connect(soil.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(1000, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(forever.previousConnection);
  const stmtIn = forever.getInput('DO').connection;
  stmtIn.connect(printLabel.previousConnection);
  printLabel.nextConnection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'soil-moisture-esp32.json',
    savePayload(
      'Example: Soil moisture (analog)',
      'esp32',
      'Analog soil sensor AO → GPIO34 (ADC1). Prints raw ADC every 1 s; calibrate dry/wet. With Wi-Fi on, prefer ADC1 pins per your module datasheet.',
      ws,
    ),
  );
  addManifest('soil-moisture-esp32.json', 'Soil moisture (analog)', 'esp32');
  ws.dispose();
}

fs.writeFileSync(path.join(examplesDir, 'index.json'), `${JSON.stringify(MANIFEST, null, 2)}\n`, 'utf8');

console.log(
  `Wrote ${MANIFEST.length} examples + index.json under public/examples/ (Arduino Uno: ${MANIFEST.filter((e) => e.boardId === 'arduino_uno').length}, ESP32: ${MANIFEST.filter((e) => e.boardId === 'esp32').length}).`,
);
