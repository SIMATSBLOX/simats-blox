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

/** @type {{ file: string, label: string, boardId: 'esp32' }[]} */
const MANIFEST = [];

function addManifest(file, label, boardId) {
  MANIFEST.push({ file, label, boardId });
}

/** ESP32 LM35: °C ≈ raw * 330 / 4095 (3.3 V ref, 12-bit ADC, 10 mV/°C). */
function lm35TempJoinEsp32(ws, adcBlock) {
  const join = ws.newBlock('text_join');
  join.itemCount_ = 3;
  join.updateShape_();
  const t0 = ws.newBlock('text');
  t0.setFieldValue('Temperature: ', 'TEXT');
  const div = ws.newBlock('math_arithmetic');
  div.setFieldValue('DIVIDE', 'OP');
  const mul = ws.newBlock('math_arithmetic');
  mul.setFieldValue('MULTIPLY', 'OP');
  mul.getInput('A').connection.connect(adcBlock.outputConnection);
  const n330 = ws.newBlock('math_number');
  n330.setFieldValue(330, 'NUM');
  const n4095 = ws.newBlock('math_number');
  n4095.setFieldValue(4095, 'NUM');
  mul.getInput('B').connection.connect(n330.outputConnection);
  div.getInput('A').connection.connect(mul.outputConnection);
  div.getInput('B').connection.connect(n4095.outputConnection);
  const t2 = ws.newBlock('text');
  t2.setFieldValue(' °C', 'TEXT');
  join.getInput('ADD0').connection.connect(t0.outputConnection);
  join.getInput('ADD1').connection.connect(div.outputConnection);
  join.getInput('ADD2').connection.connect(t2.outputConnection);
  return join;
}

// --- ESP32 MicroPython — starter + 10 curriculum sensors + actuators ---

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

// 3 DHT11 temperature & humidity
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
  dhtT.setFieldValue('DHT11', 'TYPE');
  p1.getInput('VAL').connection.connect(dhtT.outputConnection);
  const p2 = ws.newBlock('comm_serial_println');
  const dhtH = ws.newBlock('sensor_dht_mblock');
  dhtH.setFieldValue('HUM', 'DHTFIELD');
  dhtH.setFieldValue(15, 'DPIN');
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
    'dht-temp-humidity-esp32.json',
    savePayload(
      'Example: DHT11 temperature & humidity',
      'esp32',
      'DHT11 on GPIO15. Preview uses machine/dht-style helpers; allow 2 s between reads. Change the pin if your wiring differs.',
      ws,
    ),
  );
  addManifest('dht-temp-humidity-esp32.json', 'DHT11 temp & humidity', 'esp32');
  ws.dispose();
}

// 4 LM35 analog temperature (GPIO34)
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const forever = ws.newBlock('hw_forever');
  const println = ws.newBlock('comm_serial_println');
  const adc = ws.newBlock('esp32_read_analog_pin');
  adc.setFieldValue(34, 'APIN_NUM');
  const join = lm35TempJoinEsp32(ws, adc);
  println.getInput('VAL').connection.connect(join.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(500, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(forever.previousConnection);
  const stmtIn = forever.getInput('DO').connection;
  stmtIn.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'lm35-esp32.json',
    savePayload(
      'Example: LM35 analog temperature',
      'esp32',
      'LM35 → GPIO34 (ADC1). One line per loop: "Temperature: … °C" for serial bridge / Devices.',
      ws,
    ),
  );
  addManifest('lm35-esp32.json', 'LM35 analog temperature', 'esp32');
  ws.dispose();
}

// 5 MQ-2 gas (analog GPIO32)
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const forever = ws.newBlock('hw_forever');
  const println = ws.newBlock('comm_serial_println');
  const gas = ws.newBlock('sensor_analog_mblock');
  gas.setFieldValue('GAS', 'ASTYPE');
  gas.setFieldValue(32, 'APIN');
  println.getInput('VAL').connection.connect(gas.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(1000, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'mq2-esp32.json',
    savePayload(
      'Example: MQ-2 gas sensor (analog)',
      'esp32',
      'MQ-2 analog out → GPIO32 (ADC1). Raw ADC depends on wiring and heater warmup; calibrate in your lesson.',
      ws,
    ),
  );
  addManifest('mq2-esp32.json', 'MQ-2 gas (analog)', 'esp32');
  ws.dispose();
}

// 6 PIR HC-SR501 (GPIO27)
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const pm = ws.newBlock('board_pin_mode');
  pm.setFieldValue(27, 'DPIN');
  pm.setFieldValue('INPUT', 'MODE');
  const forever = ws.newBlock('hw_forever');
  const println = ws.newBlock('comm_serial_println');
  const dig = ws.newBlock('sensor_digital_mblock');
  dig.setFieldValue('PIR', 'DSTYPE');
  dig.setFieldValue(27, 'DPIN');
  println.getInput('VAL').connection.connect(dig.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(300, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(pm.previousConnection);
  pm.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'pir-hcsr501-esp32.json',
    savePayload(
      'Example: PIR motion HC-SR501',
      'esp32',
      'HC-SR501 OUT → GPIO27 as INPUT. Prints Detection: 1/0 every 300 ms.',
      ws,
    ),
  );
  addManifest('pir-hcsr501-esp32.json', 'PIR HC-SR501 motion', 'esp32');
  ws.dispose();
}

// 7 LDR (analog GPIO33)
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const forever = ws.newBlock('hw_forever');
  const println = ws.newBlock('comm_serial_println');
  const ldr = ws.newBlock('sensor_analog_mblock');
  ldr.setFieldValue('LDR', 'ASTYPE');
  ldr.setFieldValue(33, 'APIN');
  println.getInput('VAL').connection.connect(ldr.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(500, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'ldr-esp32.json',
    savePayload(
      'Example: LDR light sensor',
      'esp32',
      'Photoresistor divider → GPIO33 (ADC1). Raw value trend depends on how the divider is wired.',
      ws,
    ),
  );
  addManifest('ldr-esp32.json', 'LDR light sensor', 'esp32');
  ws.dispose();
}

// 8 HC-SR04 ultrasonic
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
      'Example: HC-SR04 ultrasonic distance',
      'esp32',
      'HC-SR04: TRIG GPIO5, ECHO GPIO18. Use 3.3 V–safe wiring or a level shifter if the module is 5 V.',
      ws,
    ),
  );
  addManifest('ultrasonic-esp32.json', 'HC-SR04 ultrasonic distance', 'esp32');
  ws.dispose();
}

// 9 BMP280 (I2C placeholder)
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const forever = ws.newBlock('hw_forever');
  const println = ws.newBlock('comm_serial_println');
  const bmp = ws.newBlock('sensor_bmp280_mblock');
  bmp.setFieldValue('TEMP', 'BMPFIELD');
  println.getInput('VAL').connection.connect(bmp.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(2000, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'bmp280-esp32.json',
    savePayload(
      'Example: BMP280 temperature (I2C)',
      'esp32',
      'BMP280 on I²C (~0x76). Preview prints 0.0 °C until you add a bmp280 driver in MicroPython.',
      ws,
    ),
  );
  addManifest('bmp280-esp32.json', 'BMP280 (I2C)', 'esp32');
  ws.dispose();
}

// 10 Soil moisture (GPIO36)
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const forever = ws.newBlock('hw_forever');
  const println = ws.newBlock('comm_serial_println');
  const soil = ws.newBlock('sensor_analog_mblock');
  soil.setFieldValue('SOIL', 'ASTYPE');
  soil.setFieldValue(36, 'APIN');
  println.getInput('VAL').connection.connect(soil.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(1000, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(forever.previousConnection);
  const stmtIn = forever.getInput('DO').connection;
  stmtIn.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'soil-moisture-esp32.json',
    savePayload(
      'Example: Soil moisture sensor',
      'esp32',
      'Analog soil sensor AO → GPIO36 (ADC1). Calibrate dry/wet; prefer ADC1 when using Wi-Fi.',
      ws,
    ),
  );
  addManifest('soil-moisture-esp32.json', 'Soil moisture sensor', 'esp32');
  ws.dispose();
}

// 11 Rain sensor (GPIO39)
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const forever = ws.newBlock('hw_forever');
  const println = ws.newBlock('comm_serial_println');
  const rain = ws.newBlock('sensor_analog_mblock');
  rain.setFieldValue('RAIN', 'ASTYPE');
  rain.setFieldValue(39, 'APIN');
  println.getInput('VAL').connection.connect(rain.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(1000, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'rain-sensor-esp32.json',
    savePayload(
      'Example: Rain sensor module',
      'esp32',
      'Rain board analog → GPIO39. Threshold depends on the onboard pot and droplet coverage.',
      ws,
    ),
  );
  addManifest('rain-sensor-esp32.json', 'Rain sensor module', 'esp32');
  ws.dispose();
}

// 12 IR obstacle avoidance (GPIO14)
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const pm = ws.newBlock('board_pin_mode');
  pm.setFieldValue(14, 'DPIN');
  pm.setFieldValue('INPUT_PULLUP', 'MODE');
  const forever = ws.newBlock('hw_forever');
  const println = ws.newBlock('comm_serial_println');
  const dig = ws.newBlock('sensor_digital_mblock');
  dig.setFieldValue('IR', 'DSTYPE');
  dig.setFieldValue(14, 'DPIN');
  println.getInput('VAL').connection.connect(dig.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(300, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(pm.previousConnection);
  pm.nextConnection.connect(forever.previousConnection);
  const stmtIn = forever.getInput('DO').connection;
  stmtIn.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'ir-obstacle-esp32.json',
    savePayload(
      'Example: IR obstacle avoidance sensor',
      'esp32',
      'IR obstacle module on GPIO14 with pull-up. Many boards are active-low; flip logic in your lesson if needed.',
      ws,
    ),
  );
  addManifest('ir-obstacle-esp32.json', 'IR obstacle avoidance', 'esp32');
  ws.dispose();
}

// 13 Servo sweep
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
      'Angles 0° / 90° / 180° on GPIO18. MicroPython preview emits teaching PWM notes — tune pulse width on hardware.',
      ws,
    ),
  );
  addManifest('servo-sweep-esp32.json', 'Servo sweep', 'esp32');
  ws.dispose();
}

// 14 DC motor (L298N-style)
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

fs.writeFileSync(path.join(examplesDir, 'index.json'), `${JSON.stringify(MANIFEST, null, 2)}\n`, 'utf8');

console.log(`Wrote ${MANIFEST.length} ESP32 examples + index.json under public/examples/.`);
