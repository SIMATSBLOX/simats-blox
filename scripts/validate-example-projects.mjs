/**
 * Validates public/examples/*.json (ESP32): blocks, pins, MicroPython codegen, Python compile.
 * Run: npm run validate:examples   (requires: python3, vite-node)
 */
import * as Blockly from 'blockly';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { registerAllBlocks } from '../src/blockly/registerBlocks.js';
import { buildMicroPythonSketch } from '../src/blockly/generators/micropythonGenerator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const examplesDir = path.join(root, 'public', 'examples');

/** ESP32 ADC1-capable GPIOs used by analog blocks in this IDE (APIN numeric on sensor_analog_mblock). */
const ADC_GPIO_OK = new Set([32, 33, 34, 35, 36, 39]);
const DIGITAL_GPIO_MAX = 39;

/** Collect all block `type` values from saved Blockly JSON */
function collectBlockTypes(node, out = new Set()) {
  if (node == null) return out;
  if (typeof node === 'object') {
    if (typeof node.type === 'string') out.add(node.type);
    for (const v of Object.values(node)) collectBlockTypes(v, out);
  }
  if (Array.isArray(node)) {
    for (const v of node) collectBlockTypes(v, out);
  }
  return out;
}

/** Walk blocks and collect pin usages: { kind, pin, blockType } */
function walkPins(block, acc) {
  if (!block || typeof block !== 'object') return;
  const t = block.type;
  const fields = block.fields || {};

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  if (t === 'sensor_analog_mblock' && fields.APIN != null) {
    const p = num(fields.APIN);
    if (p != null) acc.push({ kind: 'adc_gpio', pin: p, blockType: t });
  }
  if (t === 'mp_neopixel_setup' && fields.DPIN != null) {
    const p = num(fields.DPIN);
    if (p != null) acc.push({ kind: 'digital_gpio', pin: p, blockType: t });
  }
  if (
    (t === 'board_pin_mode' ||
      t === 'board_digital_write' ||
      t === 'board_digital_read' ||
      t === 'board_analog_write' ||
      t === 'sensor_digital_mblock' ||
      t === 'input_button_pressed' ||
      t === 'output_led' ||
      t === 'output_buzzer_tone' ||
      t === 'output_buzzer_off' ||
      t === 'output_servo_write' ||
      t === 'output_relay' ||
      t === 'sensor_dht_temp' ||
      t === 'sensor_dht_humidity' ||
      t === 'sensor_dht_mblock' ||
      t === 'sensor_ultrasonic_cm' ||
      t === 'sensor_ultrasonic_mblock' ||
      t === 'mp_pwm_write' ||
      t === 'mp_touch_read' ||
      t === 'mblock_motor_connect' ||
      t === 'mblock_motor_run' ||
      t === 'mblock_motor_free' ||
      t === 'mblock_servo_set' ||
      t === 'motor_servo' ||
      t === 'actuator_servo') &&
    fields.DPIN != null
  ) {
    const p = num(fields.DPIN);
    if (p != null) acc.push({ kind: 'digital_gpio', pin: p, blockType: t });
  }
  if ((t === 'sensor_ultrasonic_cm' || t === 'sensor_ultrasonic_mblock') && fields.TRIG != null) {
    const p = num(fields.TRIG);
    if (p != null) acc.push({ kind: 'digital_gpio', pin: p, blockType: `${t}:TRIG` });
  }
  if ((t === 'sensor_ultrasonic_cm' || t === 'sensor_ultrasonic_mblock') && fields.ECHO != null) {
    const p = num(fields.ECHO);
    if (p != null) acc.push({ kind: 'digital_gpio', pin: p, blockType: `${t}:ECHO` });
  }
  if (t === 'board_analog_read' && fields.APIN != null) {
    const label = String(fields.APIN);
    const m = /^A([0-5])$/i.exec(label.trim());
    const map = { A0: 36, A1: 39, A2: 34, A3: 35, A4: 32, A5: 33 };
    const p = m ? map[`A${m[1]}`] : map[label.toUpperCase()];
    if (p != null) acc.push({ kind: 'adc_gpio', pin: p, blockType: t });
  }
  if (t === 'esp32_read_analog_pin' && fields.APIN_NUM != null) {
    const p = num(fields.APIN_NUM);
    if (p != null) acc.push({ kind: 'adc_gpio', pin: p, blockType: t });
  }
  if (t === 'mblock_motor_connect') {
    for (const k of ['D1', 'D2', 'PWM']) {
      if (fields[k] != null) {
        const p = num(fields[k]);
        if (p != null) acc.push({ kind: 'digital_gpio', pin: p, blockType: `${t}:${k}` });
      }
    }
  }

  const next = block.next?.block;
  if (next) walkPins(next, acc);
  const inputs = block.inputs || {};
  for (const slot of Object.values(inputs)) {
    if (slot?.block) walkPins(slot.block, acc);
  }
}

function collectPinsFromBlocklySave(saveRoot) {
  const acc = [];
  const blocks = saveRoot?.blocks?.blocks;
  if (!Array.isArray(blocks)) return acc;
  for (const b of blocks) walkPins(b, acc);
  return acc;
}

function validatePins(pins) {
  const issues = [];
  for (const { kind, pin, blockType } of pins) {
    if (kind === 'digital_gpio') {
      if (pin < 0 || pin > DIGITAL_GPIO_MAX) issues.push(`Invalid digital GPIO ${pin} in ${blockType}`);
    }
    if (kind === 'adc_gpio') {
      if (!ADC_GPIO_OK.has(pin)) issues.push(`ADC/analog on GPIO ${pin} may be invalid for ESP32 ADC1 (${[...ADC_GPIO_OK].sort((a, b) => a - b).join(', ')}) — ${blockType}`);
    }
  }
  return issues;
}

function pythonCompileCheck(code) {
  const tmp = path.join(root, '.tmp-example-validate.py');
  try {
    fs.writeFileSync(tmp, code, 'utf8');
    execFileSync('python3', ['-m', 'py_compile', tmp], { stdio: 'pipe' });
    return { ok: true, err: '' };
  } catch (e) {
    return { ok: false, err: String(e?.stderr || e?.message || e) };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* */
    }
  }
}

function checkRuntimeHeuristics(code) {
  const issues = [];
  if (/while\s+True\s*:\s*\n(?:[^\n]*\n)*?(?!.*time\.sleep)/m.test(code) && !code.includes('time.sleep')) {
    issues.push('Possible busy loop: while True without time.sleep in snippet (heuristic)');
  }
  if (/while\s+True:\s*\n\s*pass\b/m.test(code)) issues.push('while True with only pass');
  return issues;
}

function checkSensorPrintFormats(code, filename) {
  const issues = [];
  if (filename.includes('ultrasonic') && !/Distance:\s*\{/.test(code) && !code.includes('Distance:')) {
    issues.push('Ultrasonic example may missing labeled Distance print');
  }
  if (filename.includes('dht') && !code.includes('Humidity:') && !code.includes('Temperature:')) {
    issues.push('DHT example may missing merged humidity/temperature print');
  }
  if (filename.includes('mq2') && !code.includes('Gas level:')) issues.push('MQ2 example may missing Gas level print');
  return issues;
}

registerAllBlocks();

const files = fs
  .readdirSync(examplesDir)
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .sort();

const results = [];

for (const file of files) {
  const full = path.join(examplesDir, file);
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (e) {
    results.push({ file, pass: false, issues: [`JSON parse error: ${e}`], fixes: [] });
    continue;
  }

  const issues = [];
  const fixes = [];

  if (payload.boardId && payload.boardId !== 'esp32') issues.push(`boardId is ${payload.boardId}, expected esp32`);

  const types = collectBlockTypes(payload.blockly);
  if (types.has('board_when_starts')) issues.push('Legacy hat board_when_starts — use esp32_when_starts in examples');
  for (const t of types) {
    if (String(t).startsWith('arduino_')) issues.push(`Unsupported legacy block type: ${t}`);
  }

  const pins = collectPinsFromBlocklySave(payload.blockly);
  const pinIssues = validatePins(pins);
  issues.push(...pinIssues);

  let code = '';
  try {
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(payload.blockly, ws);
    code = buildMicroPythonSketch(ws);
    ws.dispose();
  } catch (e) {
    issues.push(`Codegen / workspace load failed: ${e?.message || e}`);
    results.push({ file, pass: false, issues, fixes });
    continue;
  }

  if (!code.includes('def setup():') || !code.includes('def loop():') || !code.includes('while True:')) {
    issues.push('Generated sketch missing setup()/loop()/while True scaffold');
  }

  const py = pythonCompileCheck(code);
  if (!py.ok) issues.push(`Python compile: ${py.err}`);

  issues.push(...checkRuntimeHeuristics(code));
  issues.push(...checkSensorPrintFormats(code, file));

  if (file.includes('servo') && !code.includes('set_servo_angle(')) {
    issues.push('Servo example should emit set_servo_angle(...)');
  }

  const pass = issues.length === 0;
  results.push({ file, pass, issues, fixes });
}

console.log(JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass);
console.error(`\nSummary: ${results.length - failed.length}/${results.length} PASS`);
if (failed.length) {
  console.error('FAIL:', failed.map((f) => f.file).join(', '));
  process.exit(1);
}
