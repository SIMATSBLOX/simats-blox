/**
 * Regenerates the curated ESP32 MicroPython examples under public/examples/
 * and writes public/examples/index.json.
 *
 * Run: npm run build:examples
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

/** SSD1306 / I2C LCD backpack on SDA21·SCL22 — mirrors `print` lines after init. */
function newEsp32OledI2cSetup(ws) {
  const lcd = ws.newBlock('mp_display_i2c_setup');
  lcd.setFieldValue(128, 'W');
  lcd.setFieldValue(64, 'H');
  lcd.setFieldValue(22, 'SCL');
  lcd.setFieldValue(21, 'SDA');
  return lcd;
}

// --- 1 Blink LED (GPIO5 — external LED; avoids strapping on GPIO0/2/15) ---
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const pm = ws.newBlock('board_pin_mode');
  pm.setFieldValue('OUTPUT', 'MODE');
  pm.setFieldValue(5, 'DPIN');
  const forever = ws.newBlock('hw_forever');
  const wHigh = ws.newBlock('board_digital_write');
  wHigh.setFieldValue(5, 'DPIN');
  wHigh.setFieldValue('HIGH', 'LEVEL');
  const d1 = ws.newBlock('hw_wait');
  d1.setFieldValue(500, 'MS');
  const wLow = ws.newBlock('board_digital_write');
  wLow.setFieldValue(5, 'DPIN');
  wLow.setFieldValue('LOW', 'LEVEL');
  const d2 = ws.newBlock('hw_wait');
  d2.setFieldValue(500, 'MS');
  hat.nextConnection.connect(pm.previousConnection);
  pm.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(wHigh.previousConnection);
  wHigh.nextConnection.connect(d1.previousConnection);
  d1.nextConnection.connect(wLow.previousConnection);
  wLow.nextConnection.connect(d2.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'blink-led-esp32.json',
    savePayload(
      'Example: Blink LED',
      'esp32',
      'GPIO5 OUTPUT — wire an LED + resistor to GND. 500 ms on/off. Change pin if your kit differs.',
      ws,
    ),
  );
  addManifest('blink-led-esp32.json', 'Blink LED', 'esp32');
  ws.dispose();
}

// --- 2 NeoPixel WS2812 (GPIO15 = strip DI; GPIO18 reserved for servo in default kit) ---
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const neoSetup = ws.newBlock('mp_neopixel_setup');
  neoSetup.setFieldValue(15, 'DPIN');
  neoSetup.setFieldValue(8, 'COUNT');
  const msgStart = ws.newBlock('text');
  msgStart.setFieldValue(
    'NeoPixel OK — default data pin GPIO15. Change setup if your strip is on another IO.',
    'TEXT',
  );
  const printlnStart = ws.newBlock('comm_serial_println');
  printlnStart.getInput('VAL').connection.connect(msgStart.outputConnection);
  const forever = ws.newBlock('hw_forever');
  const fillR = ws.newBlock('mp_neopixel_fill');
  fillR.setFieldValue(255, 'R');
  fillR.setFieldValue(0, 'G');
  fillR.setFieldValue(0, 'B');
  const msgR = ws.newBlock('text');
  msgR.setFieldValue('NEO: red', 'TEXT');
  const printlnR = ws.newBlock('comm_serial_println');
  printlnR.getInput('VAL').connection.connect(msgR.outputConnection);
  const w1 = ws.newBlock('hw_wait');
  w1.setFieldValue(400, 'MS');
  const fillG = ws.newBlock('mp_neopixel_fill');
  fillG.setFieldValue(0, 'R');
  fillG.setFieldValue(255, 'G');
  fillG.setFieldValue(0, 'B');
  const msgG = ws.newBlock('text');
  msgG.setFieldValue('NEO: green', 'TEXT');
  const printlnG = ws.newBlock('comm_serial_println');
  printlnG.getInput('VAL').connection.connect(msgG.outputConnection);
  const w2 = ws.newBlock('hw_wait');
  w2.setFieldValue(400, 'MS');
  const fillB = ws.newBlock('mp_neopixel_fill');
  fillB.setFieldValue(0, 'R');
  fillB.setFieldValue(0, 'G');
  fillB.setFieldValue(255, 'B');
  const msgB = ws.newBlock('text');
  msgB.setFieldValue('NEO: blue', 'TEXT');
  const printlnB = ws.newBlock('comm_serial_println');
  printlnB.getInput('VAL').connection.connect(msgB.outputConnection);
  const w3 = ws.newBlock('hw_wait');
  w3.setFieldValue(400, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(neoSetup.previousConnection);
  neoSetup.nextConnection.connect(printlnStart.previousConnection);
  printlnStart.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(fillR.previousConnection);
  fillR.nextConnection.connect(printlnR.previousConnection);
  printlnR.nextConnection.connect(w1.previousConnection);
  w1.nextConnection.connect(fillG.previousConnection);
  fillG.nextConnection.connect(printlnG.previousConnection);
  printlnG.nextConnection.connect(w2.previousConnection);
  w2.nextConnection.connect(fillB.previousConnection);
  fillB.nextConnection.connect(printlnB.previousConnection);
  printlnB.nextConnection.connect(w3.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'neopixel-esp32.json',
    savePayload(
      'Example: NeoPixel strip',
      'esp32',
      'WS2812 data on GPIO15 (GPIO18 reserved for servo in default kit wiring). Count=8; 5V+GND+common ground; level-shifter if strip ignores 3.3V data.',
      ws,
    ),
  );
  addManifest('neopixel-esp32.json', 'NeoPixel strip', 'esp32');
  ws.dispose();
}

// --- 3 DHT11 (GPIO2) ---
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
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
  const lcd = newEsp32OledI2cSetup(ws);
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(lcd.previousConnection);
  lcd.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(p1.previousConnection);
  p1.nextConnection.connect(p2.previousConnection);
  p2.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'dht-temp-humidity-esp32.json',
    savePayload(
      'Example: DHT11 temperature & humidity',
      'esp32',
      'DHT11 data pin GPIO2. Optional I2C OLED/LCD (SDA21/SCL22) mirrors Serial. Allow ≥2 s between reads; one merged serial line for Devices bridge.',
      ws,
    ),
  );
  addManifest('dht-temp-humidity-esp32.json', 'DHT11 temp & humidity', 'esp32');
  ws.dispose();
}

// --- 4 HC-SR04 (TRIG 4, ECHO 13) ---
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const forever = ws.newBlock('hw_forever');
  const println = ws.newBlock('comm_serial_println');
  const ultra = ws.newBlock('sensor_ultrasonic_mblock');
  ultra.setFieldValue(4, 'TRIG');
  ultra.setFieldValue(13, 'ECHO');
  println.getInput('VAL').connection.connect(ultra.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(500, 'MS');
  const lcd = newEsp32OledI2cSetup(ws);
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(lcd.previousConnection);
  lcd.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'ultrasonic-esp32.json',
    savePayload(
      'Example: HC-SR04 ultrasonic distance',
      'esp32',
      'TRIG GPIO4, ECHO GPIO13. Optional I2C OLED/LCD mirrors distance lines. Use 3.3 V–safe wiring or level shifting if the module is 5 V.',
      ws,
    ),
  );
  addManifest('ultrasonic-esp32.json', 'HC-SR04 ultrasonic', 'esp32');
  ws.dispose();
}

// --- 5 MQ-2 analog (ADC GPIO32) ---
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
  wait.setFieldValue(500, 'MS');
  const lcd = newEsp32OledI2cSetup(ws);
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(lcd.previousConnection);
  lcd.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'mq2-esp32.json',
    savePayload(
      'Example: MQ-2 gas sensor (analog)',
      'esp32',
      'MQ-2 analog out → GPIO32 (ADC1). Optional I2C OLED/LCD mirrors gas level lines. Warm up sensor; calibrate thresholds for your module.',
      ws,
    ),
  );
  addManifest('mq2-esp32.json', 'MQ-2 gas (analog)', 'esp32');
  ws.dispose();
}

// --- 6 Soil moisture (ADC GPIO35) + I2C display (mirrors Serial lines) ---
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const lcd = newEsp32OledI2cSetup(ws);
  const forever = ws.newBlock('hw_forever');
  const println = ws.newBlock('comm_serial_println');
  const soil = ws.newBlock('sensor_analog_mblock');
  soil.setFieldValue('SOIL', 'ASTYPE');
  soil.setFieldValue(35, 'APIN');
  println.getInput('VAL').connection.connect(soil.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(500, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(lcd.previousConnection);
  lcd.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'soil-moisture-esp32.json',
    savePayload(
      'Example: Soil moisture sensor',
      'esp32',
      'Analog soil probe AO → GPIO35 (ADC1). I2C OLED/LCD on SDA21/SCL22 mirrors Serial lines. Calibrate dry/wet in firmware.',
      ws,
    ),
  );
  addManifest('soil-moisture-esp32.json', 'Soil moisture', 'esp32');
  ws.dispose();
}

// --- 7 IR obstacle (GPIO27 INPUT_PULLUP) ---
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const pm = ws.newBlock('board_pin_mode');
  pm.setFieldValue(27, 'DPIN');
  pm.setFieldValue('INPUT_PULLUP', 'MODE');
  const forever = ws.newBlock('hw_forever');
  const println = ws.newBlock('comm_serial_println');
  const ir = ws.newBlock('sensor_digital_mblock');
  ir.setFieldValue('IR', 'DSTYPE');
  ir.setFieldValue(27, 'DPIN');
  println.getInput('VAL').connection.connect(ir.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(500, 'MS');
  const lcd = newEsp32OledI2cSetup(ws);
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(lcd.previousConnection);
  lcd.nextConnection.connect(pm.previousConnection);
  pm.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'ir-obstacle-esp32.json',
    savePayload(
      'Example: IR obstacle avoidance sensor',
      'esp32',
      'IR module GPIO27 (INPUT_PULLUP). Optional I2C OLED/LCD mirrors Serial. Many modules are active-low.',
      ws,
    ),
  );
  addManifest('ir-obstacle-esp32.json', 'IR obstacle sensor', 'esp32');
  ws.dispose();
}

// --- 8 PIR HC-SR501 (GPIO12 — GPIO27 used for IR in default kit) ---
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const pm = ws.newBlock('board_pin_mode');
  pm.setFieldValue(12, 'DPIN');
  pm.setFieldValue('INPUT', 'MODE');
  const forever = ws.newBlock('hw_forever');
  const println = ws.newBlock('comm_serial_println');
  const pir = ws.newBlock('sensor_digital_mblock');
  pir.setFieldValue('PIR', 'DSTYPE');
  pir.setFieldValue(12, 'DPIN');
  println.getInput('VAL').connection.connect(pir.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(500, 'MS');
  const lcd = newEsp32OledI2cSetup(ws);
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(lcd.previousConnection);
  lcd.nextConnection.connect(pm.previousConnection);
  pm.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'pir-hcsr501-esp32.json',
    savePayload(
      'Example: PIR motion HC-SR501',
      'esp32',
      'PIR OUT → GPIO12 (INPUT). Optional I2C OLED/LCD mirrors Serial. GPIO27 reserved for IR in kit wiring. Detection: 1/0 for serial bridge.',
      ws,
    ),
  );
  addManifest('pir-hcsr501-esp32.json', 'PIR HC-SR501', 'esp32');
  ws.dispose();
}

// --- 9 LCD / OLED I2C (SDA 21, SCL 22): single-line + 2 s rotating messages ---
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const lcd = newEsp32OledI2cSetup(ws);
  const forever = ws.newBlock('hw_forever');
  const println1 = ws.newBlock('comm_serial_println');
  const txt1 = ws.newBlock('text');
  txt1.setFieldValue('SIMATS BLOX', 'TEXT');
  println1.getInput('VAL').connection.connect(txt1.outputConnection);
  const wait1 = ws.newBlock('hw_wait');
  wait1.setFieldValue(2000, 'MS');
  const println2 = ws.newBlock('comm_serial_println');
  const txt2 = ws.newBlock('text');
  txt2.setFieldValue('LCD view 2 (rotate)', 'TEXT');
  println2.getInput('VAL').connection.connect(txt2.outputConnection);
  const wait2 = ws.newBlock('hw_wait');
  wait2.setFieldValue(2000, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(lcd.previousConnection);
  lcd.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(println1.previousConnection);
  println1.nextConnection.connect(wait1.previousConnection);
  wait1.nextConnection.connect(println2.previousConnection);
  println2.nextConnection.connect(wait2.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'lcd-print-esp32.json',
    savePayload(
      'Example: LCD print (16x2)',
      'esp32',
      'MODE 1: steady title on line 1. MODE 2: second message rotates every 2 s (print mirror; I2C init once before loop).',
      ws,
    ),
  );
  addManifest('lcd-print-esp32.json', 'LCD (I2C)', 'esp32');
  ws.dispose();
}

// --- 10 Touch (GPIO14 — raw TouchPad.read() range on serial) ---
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const forever = ws.newBlock('hw_forever');
  const println = ws.newBlock('comm_serial_println');
  const touch = ws.newBlock('mp_touch_read');
  touch.setFieldValue(14, 'DPIN');
  println.getInput('VAL').connection.connect(touch.outputConnection);
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(500, 'MS');
  const lcd = newEsp32OledI2cSetup(ws);
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(lcd.previousConnection);
  lcd.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'touch-sensor-esp32.json',
    savePayload(
      'Example: ESP32 touch sensor',
      'esp32',
      'ESP32-WROOM-32 — GPIO14 touch pad. Optional I2C OLED/LCD mirrors Serial (`Touch: <raw>`; TouchPad.read(); calibrate in lessons).',
      ws,
    ),
  );
  addManifest('touch-sensor-esp32.json', 'Touch sensor', 'esp32');
  ws.dispose();
}

// --- 11 Servo sweep (PWM GPIO18) ---
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const forever = ws.newBlock('hw_forever');
  const s0 = ws.newBlock('output_servo_write');
  s0.setFieldValue(18, 'DPIN');
  s0.setFieldValue(0, 'ANGLE');
  const w0 = ws.newBlock('hw_wait');
  w0.setFieldValue(800, 'MS');
  const s90 = ws.newBlock('output_servo_write');
  s90.setFieldValue(18, 'DPIN');
  s90.setFieldValue(90, 'ANGLE');
  const w90 = ws.newBlock('hw_wait');
  w90.setFieldValue(800, 'MS');
  const s180 = ws.newBlock('output_servo_write');
  s180.setFieldValue(18, 'DPIN');
  s180.setFieldValue(180, 'ANGLE');
  const w180 = ws.newBlock('hw_wait');
  w180.setFieldValue(800, 'MS');
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(s0.previousConnection);
  s0.nextConnection.connect(w0.previousConnection);
  w0.nextConnection.connect(s90.previousConnection);
  s90.nextConnection.connect(w90.previousConnection);
  w90.nextConnection.connect(s180.previousConnection);
  s180.nextConnection.connect(w180.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'servo-sweep-esp32.json',
    savePayload(
      'Example: Servo sweep',
      'esp32',
      'Servo signal on GPIO18 (PWM). Cycles 0° / 90° / 180° with 800 ms pauses. Use a suitable power supply.',
      ws,
    ),
  );
  addManifest('servo-sweep-esp32.json', 'Servo motor', 'esp32');
  ws.dispose();
}

// --- 12 MAX30102 (I2C SDA 21, SCL 22) ---
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const ser = ws.newBlock('comm_serial_begin');
  ser.setFieldValue(115200, 'BAUD');
  const setup = ws.newBlock('mp_max30102_setup');
  setup.setFieldValue(21, 'SDA');
  setup.setFieldValue(22, 'SCL');
  const forever = ws.newBlock('hw_forever');
  const readRaw = ws.newBlock('mp_max30102_print_raw');
  const wait = ws.newBlock('hw_wait');
  wait.setFieldValue(500, 'MS');
  const lcd = newEsp32OledI2cSetup(ws);
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(lcd.previousConnection);
  lcd.nextConnection.connect(setup.previousConnection);
  setup.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(readRaw.previousConnection);
  readRaw.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'max30102-esp32.json',
    savePayload(
      'Example: MAX30102 pulse / SpO2',
      'esp32',
      'MAX30102 I2C: SDA 21, SCL 22 (same bus as optional OLED/LCD mirror). Polling mode (INT not required).',
      ws,
    ),
  );
  addManifest('max30102-esp32.json', 'MAX30102', 'esp32');
  ws.dispose();
}

// --- Combined demo (hand-maintained JSON; not overwritten by this script) ---
addManifest('all-sensors-lcd-esp32.json', 'All sensors + LCD', 'esp32');

// --- 13 Relay control (GPIO23) ---
{
  const ws = new Blockly.Workspace();
  const hat = ws.newBlock('esp32_when_starts');
  const pm = ws.newBlock('board_pin_mode');
  pm.setFieldValue(23, 'DPIN');
  pm.setFieldValue('OUTPUT', 'MODE');
  const forever = ws.newBlock('hw_forever');
  const on = ws.newBlock('output_relay');
  on.setFieldValue(23, 'DPIN');
  on.setFieldValue('HIGH', 'ON');
  const w1 = ws.newBlock('hw_wait');
  w1.setFieldValue(1000, 'MS');
  const off = ws.newBlock('output_relay');
  off.setFieldValue(23, 'DPIN');
  off.setFieldValue('LOW', 'ON');
  const w2 = ws.newBlock('hw_wait');
  w2.setFieldValue(1000, 'MS');
  hat.nextConnection.connect(pm.previousConnection);
  pm.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(on.previousConnection);
  on.nextConnection.connect(w1.previousConnection);
  w1.nextConnection.connect(off.previousConnection);
  off.nextConnection.connect(w2.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'relay-control-esp32.json',
    savePayload(
      'Example: Relay control',
      'esp32',
      'Relay IN on GPIO23 (OUTPUT). Energize 1 s / de-energize 1 s. Match active-HIGH vs active-LOW modules in lessons.',
      ws,
    ),
  );
  addManifest('relay-control-esp32.json', 'Relay control', 'esp32');
  ws.dispose();
}

// --- 14 Serial / print (basic) ---
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
  const lcd = newEsp32OledI2cSetup(ws);
  hat.nextConnection.connect(ser.previousConnection);
  ser.nextConnection.connect(lcd.previousConnection);
  lcd.nextConnection.connect(forever.previousConnection);
  forever.getInput('DO').connection.connect(println.previousConnection);
  println.nextConnection.connect(wait.previousConnection);
  hat.moveBy(20, 20);
  writeExample(
    'serial-basic-esp32.json',
    savePayload(
      'Example: Serial / print (basic)',
      'esp32',
      'USB REPL print loop — one line per second. Optional I2C OLED/LCD mirrors each line.',
      ws,
    ),
  );
  addManifest('serial-basic-esp32.json', 'Serial / print (basic)', 'esp32');
  ws.dispose();
}

fs.writeFileSync(path.join(examplesDir, 'index.json'), `${JSON.stringify(MANIFEST, null, 2)}\n`, 'utf8');
console.log(`Wrote ${MANIFEST.length} ESP32 examples + index.json under public/examples/.`);
