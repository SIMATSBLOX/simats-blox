import { CodeGenerator, Names, Variables } from 'blockly/core';

/** @typedef {'arduino_uno' | 'esp32'} BoardId */

const Order = {
  ATOMIC: 0,
  UNARY: 3,
  NONE: 99,
  MULTIPLY: 5.1,
  DIVIDE: 5.2,
  ADDITIVE: 6,
  RELATIONAL: 8,
  EQUALITY: 9,
  LOGICAL_NOT: 4.4,
  LOGICAL_AND: 13,
  LOGICAL_OR: 14,
  CONDITIONAL: 15,
};

/** @param {*} block */
function safeFieldValue(block, name, fallback = '') {
  try {
    const f = block?.getFieldValue?.(name);
    return f !== undefined && f !== null ? String(f) : fallback;
  } catch {
    return fallback;
  }
}

/** Typical ADC1 pins on ESP32 DevKit-style boards for A0–A5 labels */
const ESP32_ANALOG_GPIO = Object.freeze({
  A0: 36,
  A1: 39,
  A2: 34,
  A3: 35,
  A4: 32,
  A5: 33,
});

function clampInt(n, lo, hi) {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
}

function fieldNumberBlock(block, name, fallback, min, max) {
  const raw = Number(safeFieldValue(block, name, String(fallback)));
  const base = Number.isFinite(raw) ? raw : fallback;
  return clampInt(base, min, max);
}

/** Integer literal for digital pins (Uno 0–13, ESP32 0–39). */
function digitalPinLiteral(block, board, fieldName, defaultPin) {
  const max = board === 'esp32' ? 39 : 13;
  const def = clampInt(defaultPin, 0, max);
  return String(fieldNumberBlock(block, fieldName, def, 0, max));
}

/** Expression inside analogRead( … ) */
function analogReadPinToken(block, board) {
  const label = safeFieldValue(block, 'APIN', 'A0').trim();
  if (board === 'arduino_uno') {
    const m = /^A([0-5])$/.exec(label);
    if (m) return `A${m[1]}`;
    return 'A0';
  }
  const mapped = ESP32_ANALOG_GPIO[label];
  if (mapped !== undefined) return String(mapped);
  return '36';
}

function bluetoothDeviceNameCStr(block) {
  const raw = safeFieldValue(block, 'BTNAME', 'HW_BLOCK')
    .trim()
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
  return raw || 'HW_BLOCK';
}

/**
 * Map mBlock motor ID (MID field) to D1/D2/PWM from a matching `mblock_motor_connect` in the workspace.
 * First matching connect block wins. Returns null if none (caller uses safe defaults + comment).
 * @param {import('blockly/core/workspace').Workspace | null | undefined} ws
 * @param {'arduino_uno' | 'esp32'} board
 * @param {string} midKey
 * @returns {{ d1: string, d2: string, pwm: string } | null}
 */
function lookupMblockMotorPins(ws, board, midKey) {
  if (!ws || typeof ws.getAllBlocks !== 'function') return null;
  const want = String(midKey);
  try {
    for (const b of ws.getAllBlocks(false)) {
      if (!b || b.isDisposed() || b.type !== 'mblock_motor_connect') continue;
      const cmid = digitalPinLiteral(b, board, 'MID', 1);
      if (String(cmid) !== want) continue;
      return {
        d1: digitalPinLiteral(b, board, 'D1', 2),
        d2: digitalPinLiteral(b, board, 'D2', 4),
        pwm: digitalPinLiteral(b, board, 'PWM', 5),
      };
    }
  } catch {
    return null;
  }
  return null;
}

/** @param {'arduino_uno' | 'esp32'} board
 *  @param {string} port SERPORT field "0"|"1"|"2" */
function arduinoSerialObjectExpr(board, port) {
  if (port === '0') return 'Serial';
  if (board === 'esp32') {
    if (port === '1') return 'Serial1';
    if (port === '2') return 'Serial2';
  }
  return null;
}

/** Stable C identifier fragment for DHT instance keyed by pin + type. */
function dhtArduinoId(pinStr, typ) {
  return `P${String(pinStr)}_${typ}`.replace(/[^0-9A-Za-z]/g, '_');
}

/**
 * Emit static DHT wrapper (Adafruit DHT library) once per (pin,type). Lazy begin on first read.
 * @param {import('blockly/core/generator').CodeGenerator} gen
 */
function ensureArduinoDhtSupport(gen, pinStr, typ) {
  const id = dhtArduinoId(pinStr, typ);
  const typeMacro = typ === 'DHT22' ? 'DHT22' : 'DHT11';
  if (!gen.definitions_['%dht_lib_include']) {
    gen.definitions_['%dht_lib_include'] =
      '// DHT: install "DHT sensor library" (Adafruit) + "Adafruit Unified Sensor" from Library Manager.\n#include <DHT.h>\n';
  }
  const key = `%dht_impl_${id}`;
  if (!gen.definitions_[key]) {
    gen.definitions_[key] = `
// DHT ${typ} on digital pin ${pinStr} (single-wire bus; add 4.7k–10k pull-up from data to VCC).
static DHT __hw_dht_${id}(${pinStr}, ${typeMacro});
static bool __hw_dht_${id}_begun = false;
inline void __hw_dht_${id}_beginOnce() {
  if (!__hw_dht_${id}_begun) {
    __hw_dht_${id}.begin();
    __hw_dht_${id}_begun = true;
  }
}
inline float __hw_dht_${id}_readTempC() {
  __hw_dht_${id}_beginOnce();
  float v = __hw_dht_${id}.readTemperature();
  return isnan(v) ? NAN : v;
}
inline float __hw_dht_${id}_readHumidity() {
  __hw_dht_${id}_beginOnce();
  float v = __hw_dht_${id}.readHumidity();
  return isnan(v) ? NAN : v;
}
`;
  }
}

/** “repeat forever” / while(true) from core Blockly */
function isForeverWhileBlock(block) {
  try {
    if (!block || block.type !== 'controls_whileUntil') return false;
    if (safeFieldValue(block, 'MODE', 'WHILE') !== 'WHILE') return false;
    const ch = block.getInputTargetBlock('BOOL');
    if (!ch || ch.type !== 'logic_boolean') return false;
    return safeFieldValue(ch, 'BOOL', 'FALSE') === 'TRUE';
  } catch {
    return false;
  }
}

/** @param {string} code
 *  @param {string} indent */
function indentLines(code, indent) {
  if (!code || !String(code).trim()) return '';
  return String(code)
    .trimEnd()
    .split('\n')
    .map((ln) => (ln.length ? indent + ln : ''))
    .join('\n');
}

/**
 * Walk each “when board starts” stack: init/config statements → setup, repeat-forever / while-true bodies → loop.
 * Arduino `loop()` already repeats; do not emit `while(true)` here.
 * @param {import('blockly/core/generator').CodeGenerator} generator
 * @param {import('blockly/core/workspace').Workspace} workspace
 * @returns {{ setup: string, loopFromHat: string }}
 */
function partitionBoardStartsChains(generator, workspace) {
  const setupChunks = [];
  const hatLoopChunks = [];

  const hatTypes = new Set(['board_when_starts', 'esp32_when_starts']);
  for (const hat of workspace.getTopBlocks(true)) {
    if (!hat || hat.isDisposed() || !hatTypes.has(hat.type)) continue;

    let b = hat.getNextBlock();
    while (b) {
      if (b.isDisposed()) break;
      const t = b.type;

      if (t === 'hw_forever') {
        try {
          const inner = generator.statementToCode(b, 'DO') || '';
          if (inner.trim()) hatLoopChunks.push(inner.trimEnd());
        } catch {
          hatLoopChunks.push('// (repeat forever body skipped)\n');
        }
        b = b.getNextBlock();
        continue;
      }

      if (t === 'controls_whileUntil' && isForeverWhileBlock(b)) {
        try {
          const inner = generator.statementToCode(b, 'DO') || '';
          if (inner.trim()) hatLoopChunks.push(inner.trimEnd());
        } catch {
          hatLoopChunks.push('// (while true body skipped)\n');
        }
        b = b.getNextBlock();
        continue;
      }

      try {
        const code = generator.blockToCode(b);
        if (code && typeof code === 'string' && code.trim()) {
          setupChunks.push(code.trimEnd());
        }
      } catch {
        setupChunks.push('// (block skipped in setup)\n');
      }
      b = b.getNextBlock();
    }
  }

  return {
    setup: setupChunks.join('\n'),
    loopFromHat: hatLoopChunks.join('\n'),
  };
}

/**
 * Top-level statement stacks not under the hat (orphan chains).
 * Repeat-forever / while-true compile to their inner bodies only (no nested infinite loops).
 * @param {import('blockly/core/generator').CodeGenerator} generator
 * @param {import('blockly/core/workspace').Workspace} workspace
 */
function collectOrphanLoopStatementCode(generator, workspace) {
  const chunks = [];
  const skip = new Set(['procedures_defnoreturn', 'procedures_defreturn', 'board_when_starts', 'esp32_when_starts']);

  for (const block of workspace.getTopBlocks(true)) {
    if (!block || block.isDisposed()) continue;
    const t = block.type;
    if (skip.has(t)) continue;

    try {
      const code = generator.blockToCode(block);
      if (code && typeof code === 'string' && code.trim()) chunks.push(code.trimEnd());
    } catch {
      /* ignore */
    }
  }
  return chunks.join('\n');
}

function needsDefaultSerialBegin(setupSource) {
  return !/Serial\.begin\s*\(/i.test(setupSource || '');
}

function regenControlsIf(block, generator) {
  try {
    let n = 0;
    let code = '';
    do {
      const cond = generator.valueToCode(block, `IF${n}`, Order.NONE) || 'false';
      let branch = generator.statementToCode(block, `DO${n}`);
      code += (n > 0 ? ' else ' : '') + `if (${cond}) {\n${branch}}`;
      n++;
    } while (block.getInput(`IF${n}`));
    if (block.getInput('ELSE')) {
      const branch = generator.statementToCode(block, 'ELSE');
      code += ` else {\n${branch}}`;
    }
    return `${code}\n`;
  } catch {
    return '// Unsupported block: controls_if\n';
  }
}

function regenTextJoin(block, generator) {
  const raw = block.itemCount_;
  const count = typeof raw === 'number' && raw >= 0 ? raw : 2;
  if (count === 0) return ['String("")', Order.ATOMIC];
  const parts = [];
  for (let i = 0; i < count; i++) {
    const p = generator.valueToCode(block, `ADD${i}`, Order.ADDITIVE) || '""';
    parts.push(`String(${p})`);
  }
  if (parts.length === 1) return [parts[0], Order.ATOMIC];
  return [`(${parts.join(' + ')})`, Order.ADDITIVE];
}

/**
 * Per-block try/catch + explicit unsupported fallback so codegen never throws.
 * @param {CodeGenerator} gen
 */
function installSafeBlockToCodeWrapper(gen) {
  const original = gen.blockToCode.bind(gen);
  gen.blockToCode = function (block, opt_thisOnly) {
    if (!block) return '';
    const type = block.type || 'unknown';
    if (typeof gen.forBlock[type] !== 'function') {
      if (block.outputConnection) {
        return [`(0 /* unsupported block: ${type} */)`, Order.ATOMIC];
      }
      return `// Unsupported block: ${type}\n`;
    }
    try {
      return original(block, opt_thisOnly);
    } catch (err) {
      console.warn('[codegen] block', type, err);
      if (block.outputConnection) {
        return [`(0 /* error: ${type} */)`, Order.ATOMIC];
      }
      return `// Error generating ${type}: ${String(err?.message || err)}\n`;
    }
  };
}

/** Prevent value/statement codegen from throwing (partial graphs, missing inputs). */
function installSafeValueAndStatementWrappers(gen) {
  const v0 = gen.valueToCode.bind(gen);
  gen.valueToCode = function (block, name, outerOrder) {
    try {
      if (!block) return '';
      const out = v0(block, name, outerOrder);
      return out === undefined || out === null ? '' : out;
    } catch (e) {
      console.warn('[codegen] valueToCode', name, e);
      return '';
    }
  };
  const s0 = gen.statementToCode.bind(gen);
  gen.statementToCode = function (block, name) {
    try {
      if (!block) return '';
      const out = s0(block, name);
      return out === undefined || out === null ? '' : out;
    } catch (e) {
      console.warn('[codegen] statementToCode', name, e);
      return '';
    }
  };
}

function installSafeWorkspaceToCode(gen) {
  const w0 = gen.workspaceToCode.bind(gen);
  gen.workspaceToCode = function (workspace) {
    try {
      if (!workspace) return '';
      return w0(workspace) ?? '';
    } catch (e) {
      console.warn('[codegen] workspaceToCode', e);
      return `// Unsupported block: workspaceToCode (${String(e?.message || e)})\n`;
    }
  };
}

/**
 * @param {CodeGenerator} gen
 * @param {BoardId} board
 */
function registerStandardAndHardware(gen, board) {
  gen.definitions_['%math_h'] = '#include <math.h>\n';
  gen.forBlock['board_when_starts'] = () => '';
  gen.forBlock['esp32_when_starts'] = () => '';

  gen.forBlock['board_delay'] = (block, g) => {
    void g;
    const ms = fieldNumberBlock(block, 'MS', 1000, 0, 600000);
    return `delay(${ms});\n`;
  };
  gen.forBlock['board_pin_mode'] = (block, g) => {
    void g;
    const pin = digitalPinLiteral(block, board, 'DPIN', 2);
    const mode = safeFieldValue(block, 'MODE', 'OUTPUT');
    return `pinMode(${pin}, ${mode});\n`;
  };
  gen.forBlock['board_digital_write'] = (block, g) => {
    void g;
    const pin = digitalPinLiteral(block, board, 'DPIN', 13);
    const lv = safeFieldValue(block, 'LEVEL', 'LOW');
    return `digitalWrite(${pin}, ${lv});\n`;
  };
  gen.forBlock['board_digital_read'] = (block, g) => {
    void g;
    const pin = digitalPinLiteral(block, board, 'DPIN', 7);
    return [`digitalRead(${pin})`, Order.ATOMIC];
  };
  gen.forBlock['board_analog_read'] = (block, g) => {
    void g;
    const tok = analogReadPinToken(block, board);
    return [`analogRead(${tok})`, Order.ATOMIC];
  };
  gen.forBlock['board_analog_write'] = (block, g) => {
    void g;
    const pin = digitalPinLiteral(block, board, 'DPIN', 5);
    const v = fieldNumberBlock(block, 'DUTY', 0, 0, 255);
    if (board === 'esp32') {
      return `analogWrite(${pin}, ${v}); // ESP32: LEDC PWM on supported pins (Arduino core)\n`;
    }
    return `analogWrite(${pin}, ${v});\n`;
  };
  gen.forBlock['board_serial_begin'] = (block) => {
    const baudNum = Number(safeFieldValue(block, 'BAUD', '9600'));
    const baud = Number.isFinite(baudNum) ? baudNum : 9600;
    return `Serial.begin(${baud});\n`;
  };
  gen.forBlock['comm_serial_begin'] = gen.forBlock['board_serial_begin'];

  gen.forBlock['hw_wait'] = (block, g) => {
    void g;
    const ms = fieldNumberBlock(block, 'MS', 500, 0, 600000);
    return `delay(${ms});\n`;
  };
  gen.forBlock['hw_wait_until'] = (block, g) => {
    const c = g.valueToCode(block, 'COND', Order.NONE) || 'false';
    return `while (!(${c})) { /* wait */ }\n`;
  };

  /** Inner stack only — `loop()` repeats; never emit `while (true)` here. */
  gen.forBlock['hw_forever'] = (block, g) => {
    try {
      const branch = g.statementToCode(block, 'DO');
      return branch || '';
    } catch {
      return '// Unsupported block: hw_forever\n';
    }
  };

  gen.forBlock['hw_map_range'] = (block, g) => {
    const val = g.valueToCode(block, 'VAL', Order.NONE) || '0';
    const fl = g.valueToCode(block, 'FROM_LOW', Order.NONE) || '0';
    const fh = g.valueToCode(block, 'FROM_HIGH', Order.NONE) || '0';
    const tl = g.valueToCode(block, 'TO_LOW', Order.NONE) || '0';
    const th = g.valueToCode(block, 'TO_HIGH', Order.NONE) || '0';
    return [`map(${val}, ${fl}, ${fh}, ${tl}, ${th})`, Order.ATOMIC];
  };

  gen.forBlock['controls_if'] = regenControlsIf;
  gen.forBlock['controls_ifelse'] = regenControlsIf;
  gen.forBlock['controls_repeat_ext'] = (block, g) => {
    let times = '0';
    try {
      times = block.getField('TIMES')
        ? String(Number(block.getFieldValue('TIMES')) || 0)
        : g.valueToCode(block, 'TIMES', Order.ADDITIVE) || '0';
    } catch {
      times = '0';
    }
    const branch = g.statementToCode(block, 'DO');
    let counter = 'i';
    try {
      counter = g.nameDB_?.getDistinctName?.('i', Names.NameType.VARIABLE) ?? 'i';
    } catch {
      counter = 'i';
    }
    return `for (int ${counter} = 0; ${counter} < (${times}); ${counter}++) {\n${branch}}\n`;
  };
  gen.forBlock['controls_repeat'] = (block, g) => {
    let times = '0';
    try {
      times = String(Number(block.getFieldValue('TIMES')) || 0);
    } catch {
      times = '0';
    }
    const branch = g.statementToCode(block, 'DO');
    let counter = 'i';
    try {
      counter = g.nameDB_?.getDistinctName?.('i', Names.NameType.VARIABLE) ?? 'i';
    } catch {
      counter = 'i';
    }
    return `for (int ${counter} = 0; ${counter} < (${times}); ${counter}++) {\n${branch}}\n`;
  };

  gen.forBlock['controls_for'] = (block, g) => {
    try {
      const varName = g.getVariableName(safeFieldValue(block, 'VAR', '')) || 'i';
      const fromV = g.valueToCode(block, 'FROM', Order.NONE) || '0';
      const toV = g.valueToCode(block, 'TO', Order.NONE) || '0';
      const byV = g.valueToCode(block, 'BY', Order.NONE) || '1';
      const branch = g.statementToCode(block, 'DO');
      return `for (float ${varName} = (${fromV}); ${varName} <= (${toV}); ${varName} += (${byV})) {\n${branch}}\n`;
    } catch {
      return '// Unsupported: count loop\n';
    }
  };

  gen.forBlock['controls_whileUntil'] = (block, g) => {
    if (isForeverWhileBlock(block)) {
      try {
        const branch = g.statementToCode(block, 'DO');
        return branch || '';
      } catch {
        return '// Unsupported: while true\n';
      }
    }
    const until = safeFieldValue(block, 'MODE', 'WHILE') === 'UNTIL';
    let cond = g.valueToCode(block, 'BOOL', Order.NONE) || 'false';
    if (until) cond = `!(${cond})`;
    const branch = g.statementToCode(block, 'DO');
    return `while (${cond}) {\n${branch}}\n`;
  };
  gen.forBlock['controls_flow_statements'] = (block) => {
    const flow = safeFieldValue(block, 'FLOW', '');
    if (flow === 'BREAK') return 'break;\n';
    if (flow === 'CONTINUE') return 'continue;\n';
    return '';
  };

  gen.forBlock['logic_compare'] = (block, g) => {
    const ops = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
    const op = ops[safeFieldValue(block, 'OP', 'EQ')] ?? '==';
    const ord = op === '==' || op === '!=' ? Order.EQUALITY : Order.RELATIONAL;
    const a = g.valueToCode(block, 'A', ord) || '0';
    const b = g.valueToCode(block, 'B', ord) || '0';
    return [`(${a} ${op} ${b})`, ord];
  };
  gen.forBlock['logic_operation'] = (block, g) => {
    const op = safeFieldValue(block, 'OP', 'AND') === 'AND' ? '&&' : '||';
    const ord = op === '&&' ? Order.LOGICAL_AND : Order.LOGICAL_OR;
    let a = g.valueToCode(block, 'A', ord) || 'false';
    let b = g.valueToCode(block, 'B', ord) || 'false';
    return [`(${a} ${op} ${b})`, ord];
  };
  gen.forBlock['logic_negate'] = (block, g) => {
    const v = g.valueToCode(block, 'BOOL', Order.LOGICAL_NOT) || 'false';
    return [`!(${v})`, Order.LOGICAL_NOT];
  };
  gen.forBlock['logic_boolean'] = (block) => {
    const v = safeFieldValue(block, 'BOOL', 'FALSE') === 'TRUE' ? 'true' : 'false';
    return [v, Order.ATOMIC];
  };

  gen.forBlock['math_number'] = (block) => {
    const n = Number(safeFieldValue(block, 'NUM', '0'));
    const num = Number.isFinite(n) ? n : 0;
    const ord = num < 0 ? Order.UNARY : Order.ATOMIC;
    return [String(num), ord];
  };
  gen.forBlock['math_arithmetic'] = (block, g) => {
    const op = safeFieldValue(block, 'OP', 'ADD');
    if (op === 'POWER') {
      const a = g.valueToCode(block, 'A', Order.NONE) || '0';
      const b = g.valueToCode(block, 'B', Order.NONE) || '0';
      return [`pow(${a}, ${b})`, Order.ATOMIC];
    }
    const table = {
      ADD: [' + ', Order.ADDITIVE],
      MINUS: [' - ', Order.ADDITIVE],
      MULTIPLY: [' * ', Order.MULTIPLY],
      DIVIDE: [' / ', Order.DIVIDE],
    };
    const row = table[op] ?? table.ADD;
    const sym = row[0];
    const ord = row[1];
    const a = g.valueToCode(block, 'A', ord) || '0';
    const b = g.valueToCode(block, 'B', ord) || '0';
    return [`(${a}${sym}${b})`, ord];
  };

  gen.forBlock['math_modulo'] = (block, g) => {
    const a = g.valueToCode(block, 'DIVIDEND', Order.MULTIPLY) || '0';
    const b = g.valueToCode(block, 'DIVISOR', Order.MULTIPLY) || '1';
    return [`(${a} % ${b})`, Order.MULTIPLY];
  };

  gen.forBlock['math_constrain'] = (block, g) => {
    const v = g.valueToCode(block, 'VALUE', Order.NONE) || '0';
    const lo = g.valueToCode(block, 'LOW', Order.NONE) || '0';
    const hi = g.valueToCode(block, 'HIGH', Order.NONE) || '0';
    return [`constrain(${v}, ${lo}, ${hi})`, Order.ATOMIC];
  };

  gen.forBlock['math_random_int'] = (block, g) => {
    const from = g.valueToCode(block, 'FROM', Order.NONE) || '0';
    const to = g.valueToCode(block, 'TO', Order.NONE) || '0';
    return [`random(${from}, (${to}) + 1)`, Order.ATOMIC];
  };

  gen.forBlock['math_change'] = (block, g) => {
    const d = g.valueToCode(block, 'DELTA', Order.ADDITIVE) || '0';
    try {
      const name = g.getVariableName(safeFieldValue(block, 'VAR', ''));
      return `${name} += ${d};\n`;
    } catch {
      return '// Error: math_change variable\n';
    }
  };

  gen.forBlock['math_round'] = (block, g) => {
    const op = safeFieldValue(block, 'OP', 'ROUND');
    const num = g.valueToCode(block, 'NUM', Order.NONE) || '0';
    if (op === 'ROUNDUP') return [`ceil(${num})`, Order.ATOMIC];
    if (op === 'ROUNDDOWN') return [`floor(${num})`, Order.ATOMIC];
    return [`round(${num})`, Order.ATOMIC];
  };

  gen.forBlock['math_single'] = (block, g) => {
    const op = safeFieldValue(block, 'OP', 'ABS');
    const num = g.valueToCode(block, 'NUM', Order.NONE) || '0';
    const map = {
      ABS: () => `abs(${num})`,
      NEG: () => `(-(${num}))`,
      ROOT: () => `sqrt(${num})`,
      LN: () => `log(${num})`,
      LOG10: () => `(log(${num}) / log(10))`,
      EXP: () => `exp(${num})`,
      POW10: () => `pow(10, ${num})`,
      SIN: () => `sin(${num} * PI / 180.0)`,
      COS: () => `cos(${num} * PI / 180.0)`,
      TAN: () => `tan(${num} * PI / 180.0)`,
      ASIN: () => `(asin(${num}) * 180.0 / PI)`,
      ACOS: () => `(acos(${num}) * 180.0 / PI)`,
      ATAN: () => `(atan(${num}) * 180.0 / PI)`,
    };
    const fn = map[op];
    if (!fn) return ['0', Order.ATOMIC];
    return [fn(), Order.ATOMIC];
  };

  gen.forBlock['text'] = (block) => {
    const raw = safeFieldValue(block, 'TEXT', '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return [`"${raw}"`, Order.ATOMIC];
  };
  gen.forBlock['text_join'] = regenTextJoin;

  gen.forBlock['text_length'] = (block, g) => {
    const v = g.valueToCode(block, 'VALUE', Order.NONE) || 'String("")';
    return [`String(${v}).length()`, Order.ATOMIC];
  };

  gen.forBlock['variables_get'] = (block, g) => {
    try {
      const name = g.getVariableName(safeFieldValue(block, 'VAR', ''));
      return [name && String(name).trim() ? name : 'item', Order.ATOMIC];
    } catch {
      return ['item', Order.ATOMIC];
    }
  };
  gen.forBlock['variables_set'] = (block, g) => {
    try {
      const name = g.getVariableName(safeFieldValue(block, 'VAR', ''));
      const val = g.valueToCode(block, 'VALUE', Order.NONE) || '0';
      return `${name} = ${val};\n`;
    } catch {
      return '// Error: variables_set\n';
    }
  };
  gen.forBlock['variables_change'] = (block, g) => {
    try {
      const name = g.getVariableName(safeFieldValue(block, 'VAR', ''));
      const d = g.valueToCode(block, 'DELTA', Order.ADDITIVE) || '0';
      return `${name} += ${d};\n`;
    } catch {
      return '// Error: variables_change\n';
    }
  };

  gen.forBlock['procedures_defnoreturn'] = (block, g) => {
    try {
      const rawName = g.getProcedureName(safeFieldValue(block, 'NAME', 'myFunction'));
      const inner = g.statementToCode(block, 'STACK');
      g.definitions_[`%proc_${rawName}`] = `void ${rawName}() {\n${inner}}\n`;
    } catch (e) {
      console.warn('[codegen] procedures_defnoreturn', e);
    }
    return null;
  };

  gen.forBlock['procedures_defreturn'] = (block, g) => {
    try {
      const rawName = g.getProcedureName(safeFieldValue(block, 'NAME', 'myFunction'));
      const inner = g.statementToCode(block, 'STACK');
      const ret = block.getInput('RETURN')
        ? g.valueToCode(block, 'RETURN', Order.NONE) || '0'
        : '0';
      let params = '';
      try {
        const varIds = typeof block.getVars === 'function' ? block.getVars() : [];
        params = varIds.map((id) => `float ${g.getVariableName(id)}`).join(', ');
      } catch {
        params = '';
      }
      g.definitions_[`%proc_${rawName}`] = `float ${rawName}(${params}) {\n${inner}  return ${ret};\n}\n`;
    } catch (e) {
      console.warn('[codegen] procedures_defreturn', e);
    }
    return null;
  };

  gen.forBlock['procedures_callreturn'] = (block, g) => {
    try {
      const name = g.getProcedureName(safeFieldValue(block, 'NAME', ''));
      const args = [];
      for (let i = 0; block.getInput('ARG' + i); i++) {
        args.push(g.valueToCode(block, 'ARG' + i, Order.NONE) || '0');
      }
      return [`${name}(${args.join(', ')})`, Order.ATOMIC];
    } catch {
      return ['0', Order.ATOMIC];
    }
  };

  gen.forBlock['procedures_callnoreturn'] = (block, g) => {
    try {
      const name = g.getProcedureName(safeFieldValue(block, 'NAME', ''));
      const args = [];
      for (let i = 0; block.getInput('ARG' + i); i++) {
        args.push(g.valueToCode(block, 'ARG' + i, Order.NONE) || '0');
      }
      return `${name}(${args.join(', ')});\n`;
    } catch {
      return '// Error: procedures_callnoreturn\n';
    }
  };

  gen.forBlock['input_button_pressed'] = (block, g) => {
    void g;
    const pin = digitalPinLiteral(block, board, 'DPIN', 2);
    return [`(digitalRead(${pin}) == HIGH)`, Order.ATOMIC];
  };
  gen.forBlock['input_potentiometer'] = (block, g) => {
    void g;
    const tok = analogReadPinToken(block, board);
    return [`analogRead(${tok})`, Order.ATOMIC];
  };
  gen.forBlock['input_ir_read'] = (block, g) => {
    void g;
    const tok = analogReadPinToken(block, board);
    return [`analogRead(${tok})`, Order.ATOMIC];
  };
  gen.forBlock['input_pir_read'] = (block, g) => {
    void g;
    const pin = digitalPinLiteral(block, board, 'DPIN', 8);
    return [`(digitalRead(${pin}) == HIGH)`, Order.ATOMIC];
  };

  gen.forBlock['output_led'] = (block, g) => {
    void g;
    const pin = digitalPinLiteral(block, board, 'DPIN', 13);
    const lv = safeFieldValue(block, 'ON', 'LOW');
    return `digitalWrite(${pin}, ${lv});\n`;
  };
  gen.forBlock['output_buzzer_tone'] = (block, g) => {
    void g;
    const pin = digitalPinLiteral(block, board, 'DPIN', 9);
    const f = fieldNumberBlock(block, 'FREQ', 440, 20, 20000);
    const d = fieldNumberBlock(block, 'DUR', 200, 0, 60000);
    return `tone(${pin}, ${f}, ${d});\n`;
  };
  gen.forBlock['output_buzzer_off'] = (block, g) => {
    void g;
    const pin = digitalPinLiteral(block, board, 'DPIN', 9);
    return `noTone(${pin});\n`;
  };
  gen.forBlock['output_servo_write'] = (block, g) => {
    if (!gen.definitions_['%servo_hdr']) {
      gen.definitions_['%servo_hdr'] = `
#include <Servo.h>
static Servo __hw_servo_inst;
static int __hw_servo_pin = -1;
inline void __hw_servo_write(int pin, int ang) {
  if (__hw_servo_pin != pin) {
    if (__hw_servo_pin != -1) __hw_servo_inst.detach();
    __hw_servo_inst.attach(pin);
    __hw_servo_pin = pin;
  }
  __hw_servo_inst.write(ang);
}
`;
    }
    void g;
    const pin = digitalPinLiteral(block, board, 'DPIN', 9);
    const ang = fieldNumberBlock(block, 'ANGLE', 90, 0, 180);
    return `__hw_servo_write(${pin}, ${ang});\n`;
  };
  gen.forBlock['output_motor_run'] = (block, g) => {
    void g;
    const pin = digitalPinLiteral(block, board, 'DPIN', 5);
    const spd = fieldNumberBlock(block, 'SPEED', 0, 0, 255);
    if (board === 'esp32') {
      return `analogWrite(${pin}, ${spd}); // use a motor driver; ESP32 LEDC PWM\n`;
    }
    return `analogWrite(${pin}, ${spd});\n`;
  };
  gen.forBlock['output_relay'] = (block, g) => {
    void g;
    const pin = digitalPinLiteral(block, board, 'DPIN', 7);
    const lv = safeFieldValue(block, 'ON', '') || safeFieldValue(block, 'RELST', 'LOW');
    return `digitalWrite(${pin}, ${lv});\n`;
  };

  /** HC-SR04: helper via provideFunction_ (requires gen.nameDB_ — set in buildSketch after init). */
  gen.forBlock['sensor_ultrasonic_cm'] = (block, generator) => {
    try {
      const body = `
long ${generator.FUNCTION_NAME_PLACEHOLDER_}(int trig, int echo) {
  static int __lastTrig = -1, __lastEcho = -1;
  if (trig != __lastTrig || echo != __lastEcho) {
    pinMode(trig, OUTPUT);
    pinMode(echo, INPUT);
    __lastTrig = trig;
    __lastEcho = echo;
  }
  digitalWrite(trig, LOW);
  delayMicroseconds(2);
  digitalWrite(trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long dur = pulseIn(echo, HIGH, 30000);
  if (dur == 0) return -1L;
  return (long)(dur * 0.034 / 2.0);
}
`;
      const ultraFn = generator.provideFunction_('hw_ultra_cm', body);
      const t = digitalPinLiteral(block, board, 'TRIG', 12);
      const e = digitalPinLiteral(block, board, 'ECHO', 11);
      return [`${ultraFn}(${t}, ${e}) /* HC-SR04-style distance (cm); timeout → -1 */`, Order.ATOMIC];
    } catch (e) {
      console.warn('[codegen] ultrasonic helper', e);
      return ['0', Order.ATOMIC];
    }
  };

  gen.forBlock['sensor_dht_temp'] = (block, g) => {
    void g;
    const pin = digitalPinLiteral(block, board, 'DPIN', 2);
    const typ = safeFieldValue(block, 'TYPE', 'DHT11');
    try {
      ensureArduinoDhtSupport(gen, pin, typ);
      const id = dhtArduinoId(pin, typ);
      return [`(__hw_dht_${id}_readTempC())`, Order.ATOMIC];
    } catch {
      return ['(NAN /* DHT temperature: generator init skipped */)', Order.ATOMIC];
    }
  };
  gen.forBlock['sensor_dht_humidity'] = (block, g) => {
    void g;
    const pin = digitalPinLiteral(block, board, 'DPIN', 2);
    const typ = safeFieldValue(block, 'TYPE', 'DHT11');
    try {
      ensureArduinoDhtSupport(gen, pin, typ);
      const id = dhtArduinoId(pin, typ);
      return [`(__hw_dht_${id}_readHumidity())`, Order.ATOMIC];
    } catch {
      return ['(NAN /* DHT humidity: generator init skipped */)', Order.ATOMIC];
    }
  };
  gen.forBlock['sensor_ldr'] = (block, g) => {
    void g;
    const tok = analogReadPinToken(block, board);
    return [`analogRead(${tok})`, Order.ATOMIC];
  };
  gen.forBlock['sensor_soil'] = (block, g) => {
    void g;
    const tok = analogReadPinToken(block, board);
    return [`analogRead(${tok})`, Order.ATOMIC];
  };
  gen.forBlock['sensor_gas'] = (block, g) => {
    void g;
    const tok = analogReadPinToken(block, board);
    return [`analogRead(${tok})`, Order.ATOMIC];
  };

  gen.forBlock['comm_serial_print'] = (block, g) => {
    const v = g.valueToCode(block, 'VAL', Order.NONE) || '0';
    return `Serial.print(${v});\n`;
  };
  gen.forBlock['comm_serial_println'] = (block, g) => {
    const v = g.valueToCode(block, 'VAL', Order.NONE) || '0';
    return `Serial.println(${v});\n`;
  };

  if (board === 'esp32') {
    if (!gen.definitions_['%bt_esp32']) {
      gen.definitions_['%bt_esp32'] = `
#include "BluetoothSerial.h"
BluetoothSerial SerialBT;
`;
    }
    gen.forBlock['comm_bt_begin'] = (block, g) => {
      void g;
      const name = bluetoothDeviceNameCStr(block);
      return `SerialBT.begin("${name}"); // ESP32 classic Bluetooth (BluetoothSerial)\n`;
    };
    gen.forBlock['comm_bt_send'] = (block, g) => {
      const v = g.valueToCode(block, 'VAL', Order.NONE) || '""';
      return `SerialBT.println(${v});\n`;
    };
    gen.forBlock['comm_bt_available'] = () => ['(SerialBT.available() > 0)', Order.ATOMIC];
    gen.forBlock['comm_bt_read'] = () => ['SerialBT.readString()', Order.ATOMIC];
  } else {
    gen.forBlock['comm_bt_begin'] = () =>
      [
        '// Bluetooth (Arduino Uno): no on-board Bluetooth — add HC-05/HC-06 (or similar) on UART.\n',
        '// Typical wiring uses hardware Serial (0/1) or a second SoftwareSerial port; match baud to the module.\n',
      ].join('');
    gen.forBlock['comm_bt_send'] = (block, g) => {
      const v = g.valueToCode(block, 'VAL', Order.NONE) || '""';
      return [
        '// Bluetooth send (Uno): use your module’s stream after wiring, e.g.\n',
        `// btStream.println(${v});\n`,
      ].join('');
    };
    gen.forBlock['comm_bt_available'] = () => [
      '(/* Uno: use e.g. btStream.available() > 0 once a UART is wired */ false)',
      Order.ATOMIC,
    ];
    gen.forBlock['comm_bt_read'] = () => [
      '(/* Uno: use e.g. btStream.readString() once a UART is wired */ String())',
      Order.ATOMIC,
    ];
  }

  /* —— mBlock-style hardware library (labels) —— */
  const mblockCStr = (s) =>
    String(s ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r|\n/g, ' ');

  gen.forBlock['mblock_wait_seconds'] = (block, g) => {
    void g;
    const sec = Number(safeFieldValue(block, 'SEC', '1'));
    const ms = Number.isFinite(sec) ? Math.max(0, Math.round(sec * 1000)) : 1000;
    return `delay(${ms});\n`;
  };
  gen.forBlock['mblock_stop'] = (block, g) => {
    void g;
    const which = safeFieldValue(block, 'WHICH', 'ALL');
    return `// stop ${which} (hardware IDE — no sprite engine)\n`;
  };
  gen.forBlock['mblock_show_variable'] = (block, g) => {
    void g;
    try {
      const nm = g.getVariableName(safeFieldValue(block, 'VAR', ''));
      return `// show variable ${mblockCStr(nm)} (monitor not implemented)\n`;
    } catch {
      return '// show variable (error)\n';
    }
  };
  gen.forBlock['mblock_hide_variable'] = (block, g) => {
    void g;
    try {
      const nm = g.getVariableName(safeFieldValue(block, 'VAR', ''));
      return `// hide variable ${mblockCStr(nm)}\n`;
    } catch {
      return '// hide variable (error)\n';
    }
  };
  gen.forBlock['mblock_text_contains'] = (block, g) => {
    void g;
    const hay = mblockCStr(safeFieldValue(block, 'HAY', ''));
    const nd = mblockCStr(safeFieldValue(block, 'NEEDLE', ''));
    return [`(String("${hay}").indexOf(String("${nd}")) >= 0)`, Order.ATOMIC];
  };
  gen.forBlock['mblock_letter_of'] = (block, g) => {
    void g;
    const n = Math.max(1, fieldNumberBlock(block, 'N', 1, 1, 999));
    const t = mblockCStr(safeFieldValue(block, 'TEXT', ''));
    return [`String("${t}").substring(${n} - 1, ${n})`, Order.ATOMIC];
  };
  gen.forBlock['mblock_map_inline'] = (block, g) => {
    void g;
    const v = fieldNumberBlock(block, 'V', 50, -32768, 32767);
    const fl = fieldNumberBlock(block, 'FL', 0, -32768, 32767);
    const fh = fieldNumberBlock(block, 'FH', 255, -32768, 32767);
    const tl = fieldNumberBlock(block, 'TL', 0, -32768, 32767);
    const th = fieldNumberBlock(block, 'TH', 1023, -32768, 32767);
    return [`map(${v}, ${fl}, ${fh}, ${tl}, ${th})`, Order.ATOMIC];
  };

  gen.forBlock['esp32_digital_read_boolean'] = (block, g) => {
    void g;
    const pin = digitalPinLiteral(block, board, 'DPIN', 2);
    return [`(digitalRead(${pin}) == HIGH)`, Order.ATOMIC];
  };
  gen.forBlock['esp32_read_analog_pin'] = (block, g) => {
    void g;
    const n = fieldNumberBlock(block, 'APIN_NUM', 32, 0, 39);
    if (board === 'arduino_uno') {
      let idx = -1;
      if (n >= 0 && n <= 5) idx = n;
      else if (n >= 14 && n <= 19) idx = n - 14;
      if (idx >= 0 && idx <= 5) {
        return [`analogRead(A${idx})`, Order.ATOMIC];
      }
      return [`analogRead(A0) /* Uno: use APIN_NUM 0–5 or 14–19 (A0–A5) */`, Order.ATOMIC];
    }
    // ESP32: ADC1 preferred for Wi-Fi stability; GPIO 25+ often ADC2 (may be noisy when Wi-Fi on).
    return [`analogRead(${n}) /* ESP32: verify pin is ADC-capable on your module */`, Order.ATOMIC];
  };
  gen.forBlock['esp32_set_digital_out'] = gen.forBlock['board_digital_write'];
  gen.forBlock['esp32_set_pwm_pin'] = gen.forBlock['board_analog_write'];
  gen.forBlock['esp32_touch_read_labeled'] = (block, g) => {
    void g;
    const gpio = Number(safeFieldValue(block, 'TPAD', '15')) || 15;
    if (board !== 'esp32') {
      return ['0 /* touch: ESP32 only */', Order.ATOMIC];
    }
    return [`touchRead(${gpio})`, Order.ATOMIC];
  };
  gen.forBlock['esp32_hall_value'] = (block, g) => {
    void g;
    if (board !== 'esp32') return ['0 /* hall: ESP32 only */', Order.ATOMIC];
    return ['hallRead()', Order.ATOMIC];
  };
  gen.forBlock['esp32_bluetooth_mac'] = (block, g) => {
    void g;
    if (board !== 'esp32') {
      return ['String("00:00:00:00:00:00") /* WiFi/BT MAC: ESP32 */', Order.ATOMIC];
    }
    if (!gen.definitions_['%wifi_for_mac']) gen.definitions_['%wifi_for_mac'] = '#include <WiFi.h>\n';
    return ['WiFi.macAddress()', Order.ATOMIC];
  };

  gen.forBlock['mblock_motor_connect'] = (block, g) => {
    void g;
    const mid = digitalPinLiteral(block, board, 'MID', 1);
    const d1 = digitalPinLiteral(block, board, 'D1', 2);
    const d2 = digitalPinLiteral(block, board, 'D2', 4);
    const pwm = digitalPinLiteral(block, board, 'PWM', 5);
    return [
      `// Motor ${mid}: IN1=${d1}, IN2=${d2}, PWM/ENA=${pwm} (typical L298N / DRV8833 wiring)\n`,
      `pinMode(${d1}, OUTPUT);\n`,
      `pinMode(${d2}, OUTPUT);\n`,
      `pinMode(${pwm}, OUTPUT);\n`,
    ].join('');
  };
  gen.forBlock['mblock_motor_run'] = (block, g) => {
    void g;
    const mid = digitalPinLiteral(block, board, 'MID', 1);
    const cfg = lookupMblockMotorPins(block.workspace, board, mid);
    const d1 = cfg?.d1 ?? '2';
    const d2 = cfg?.d2 ?? '4';
    const pwm = cfg?.pwm ?? '5';
    const warn = cfg
      ? ''
      : `// Motor ${mid}: no matching "connect motor" block — default pins ${d1}/${d2}/${pwm}\n`;
    const dir = safeFieldValue(block, 'MDIR', 'FWD');
    const spd = fieldNumberBlock(block, 'SPEED', 100, 0, 255);
    const fwd = dir === 'FWD';
    return [
      warn,
      `digitalWrite(${d1}, ${fwd ? 'HIGH' : 'LOW'});\n`,
      `digitalWrite(${d2}, ${fwd ? 'LOW' : 'HIGH'});\n`,
      `analogWrite(${pwm}, ${spd}); // ESP32: ensure PWM-capable pin (LEDC)\n`,
    ].join('');
  };
  gen.forBlock['mblock_motor_free'] = (block, g) => {
    void g;
    const kind = safeFieldValue(block, 'KIND', 'MOTOR');
    const mid = digitalPinLiteral(block, board, 'MID', 1);
    if (kind !== 'MOTOR') {
      return `// free ${kind} ${mid} — detach servo in your driver code if needed\n`;
    }
    const cfg = lookupMblockMotorPins(block.workspace, board, mid);
    const d1 = cfg?.d1 ?? '2';
    const d2 = cfg?.d2 ?? '4';
    const pwm = cfg?.pwm ?? '5';
    const warn = cfg ? '' : `// Motor ${mid}: no matching "connect motor" — default pins ${d1}/${d2}/${pwm}\n`;
    return [
      warn,
      `digitalWrite(${d1}, LOW);\n`,
      `digitalWrite(${d2}, LOW);\n`,
      `analogWrite(${pwm}, 0);\n`,
    ].join('');
  };
  gen.forBlock['mblock_servo_set'] = gen.forBlock['output_servo_write'];
  gen.forBlock['mblock_relay_set'] = (block, g) => {
    void g;
    const pin = digitalPinLiteral(block, board, 'DPIN', 3);
    const lv = safeFieldValue(block, 'RELST', 'LOW');
    return `digitalWrite(${pin}, ${lv});\n`;
  };

  gen.forBlock['sensor_ultrasonic_mblock'] = gen.forBlock['sensor_ultrasonic_cm'];
  gen.forBlock['sensor_digital_mblock'] = (block, g) => {
    void g;
    const pin = digitalPinLiteral(block, board, 'DPIN', 2);
    const st = safeFieldValue(block, 'DSTYPE', 'PIR');
    return [
      `(digitalRead(${pin}) == HIGH) /* digital sensor: ${st}; use INPUT_PULLUP in setup if active-low */`,
      Order.ATOMIC,
    ];
  };
  gen.forBlock['sensor_dht_mblock'] = (block, g) => {
    void g;
    const fld = safeFieldValue(block, 'DHTFIELD', 'TEMP');
    if (fld === 'HUM') {
      return gen.forBlock['sensor_dht_humidity'](block, g);
    }
    return gen.forBlock['sensor_dht_temp'](block, g);
  };
  gen.forBlock['sensor_analog_mblock'] = (block, g) => {
    void g;
    const n = fieldNumberBlock(block, 'APIN', 32, 0, 39);
    const tag = safeFieldValue(block, 'ASTYPE', 'LDR');
    if (board === 'arduino_uno') {
      let idx = -1;
      if (n >= 0 && n <= 5) idx = n;
      else if (n >= 14 && n <= 19) idx = n - 14;
      if (idx >= 0 && idx <= 5) {
        return [`analogRead(A${idx}) /* ${tag} */`, Order.ATOMIC];
      }
      return [`analogRead(A0) /* ${tag} — on Uno use APIN 0–5 or 14–19 (A0–A5) */`, Order.ATOMIC];
    }
    return [`analogRead(${n}) /* ${tag}; ESP32: use ADC-capable GPIO */`, Order.ATOMIC];
  };

  const mblockIotComment = (text) => `// IoT / phone bridge: ${text}\n`;
  gen.forBlock['mblock_iot_create_file'] = (block, g) => {
    void g;
    return mblockIotComment(`create ${safeFieldValue(block, 'FTYPE', 'FILE')} "${mblockCStr(safeFieldValue(block, 'FNAME', ''))}" — not emitted on device`);
  };
  gen.forBlock['mblock_iot_log'] = (block, g) => {
    void g;
    const c = mblockCStr(safeFieldValue(block, 'COL', ''));
    const v = fieldNumberBlock(block, 'VAL', 0, -32768, 32767);
    return mblockIotComment(`log column "${c}" value ${v}`);
  };
  gen.forBlock['mblock_iot_stop_logger'] = () => mblockIotComment('stop data logger');
  gen.forBlock['mblock_iot_notify'] = (block, g) => {
    void g;
    return mblockIotComment(
      `notify "${mblockCStr(safeFieldValue(block, 'TITLE', ''))}" / "${mblockCStr(safeFieldValue(block, 'MSG', ''))}"`,
    );
  };
  gen.forBlock['mblock_iot_clear_notify'] = () => mblockIotComment('clear notification');
  gen.forBlock['mblock_music_play'] = (block, g) => {
    void g;
    return mblockIotComment(`play ${safeFieldValue(block, 'PLAYMODE', 'PLAY')} "${mblockCStr(safeFieldValue(block, 'NOTE', ''))}"`);
  };
  gen.forBlock['mblock_music_stop'] = () => mblockIotComment('stop music');

  gen.forBlock['comm_bt_serial_baud'] = (block, g) => {
    void g;
    const b = safeFieldValue(block, 'BAUD', '9600');
    return `// set Bluetooth serial baud ${b} (module-dependent; often fixed in firmware)\n`;
  };
  gen.forBlock['comm_serial_set_pins'] = (block, g) => {
    void g;
    const tx = digitalPinLiteral(block, board, 'TX', 19);
    const rx = digitalPinLiteral(block, board, 'RX', 18);
    const ser = safeFieldValue(block, 'SERPORT', '1');
    return `// UART ${ser}: TX=${tx}, RX=${rx} — use HardwareSerial / SoftwareSerial as needed\n`;
  };
  gen.forBlock['comm_bt_configure'] = (block, g) => {
    void g;
    const name = mblockCStr(safeFieldValue(block, 'BTNAME', 'MyEsp32'));
    if (board === 'esp32') {
      if (!gen.definitions_['%bt_esp32']) {
        gen.definitions_['%bt_esp32'] = `
#include "BluetoothSerial.h"
BluetoothSerial SerialBT;
`;
      }
      return `SerialBT.begin("${name}"); // ${safeFieldValue(block, 'BTMODE', 'CLASSIC')}\n`;
    }
    return `// configure BT as "${name}" (ESP32 classic/BLE — add library on Uno)\n`;
  };
  gen.forBlock['comm_serial_baud_mblock'] = (block, g) => {
    void g;
    const port = safeFieldValue(block, 'SERPORT', '0');
    const baud = safeFieldValue(block, 'BAUD', '115200');
    if (port === '0') {
      return `Serial.begin(${baud});\n`;
    }
    if (board === 'arduino_uno') {
      return [
        `// Uno (ATmega328P): only one hardware UART (USB). For extra UART use SoftwareSerial / AltSoftSerial.\n`,
        `// Example: SoftwareSerial ss(RX_PIN, TX_PIN); ss.begin(${baud});\n`,
      ].join('');
    }
    if (board === 'esp32') {
      if (port === '1') {
        return `Serial1.begin(${baud}); // ESP32: set RX/TX GPIOs in begin() if your board needs explicit pins\n`;
      }
      if (port === '2') {
        return `Serial2.begin(${baud}); // ESP32: verify default pins or pass rx, tx per core docs\n`;
      }
    }
    return `// Serial ${port} @ ${baud} — init in sketch for your board\n`;
  };
  gen.forBlock['comm_serial_bytes_available'] = (block, g) => {
    void g;
    const port = safeFieldValue(block, 'SERPORT', '0');
    const ser = arduinoSerialObjectExpr(board, port);
    if (ser) return [`(${ser}.available() > 0)`, Order.ATOMIC];
    if (board === 'arduino_uno' && port !== '0') {
      return [
        '(false /* Uno: use your SoftwareSerial instance, e.g. ss.available() > 0 */)',
        Order.ATOMIC,
      ];
    }
    return [`(false /* Serial ${port}: not generated — init UART first */)`, Order.ATOMIC];
  };
  gen.forBlock['comm_bt_data_available'] = gen.forBlock['comm_bt_available'];
  gen.forBlock['comm_bt_read_bytes'] = gen.forBlock['comm_bt_read'];
  gen.forBlock['comm_bt_send_text'] = (block, g) => {
    void g;
    const line = mblockCStr(safeFieldValue(block, 'LINE', ''));
    if (board === 'esp32') {
      if (!gen.definitions_['%bt_esp32']) {
        gen.definitions_['%bt_esp32'] = `
#include "BluetoothSerial.h"
BluetoothSerial SerialBT;
`;
      }
      return `SerialBT.println("${line}"); // requires SerialBT.begin(...) in setup (see "configure Bluetooth")\n`;
    }
    return [
      `// Uno: no native Bluetooth — use HC-05/06 AT UART, then e.g. bt.println("${line}");\n`,
    ].join('');
  };
  gen.forBlock['comm_serial_read_bytes'] = (block, g) => {
    void g;
    const port = safeFieldValue(block, 'SERPORT', '0');
    const ser = arduinoSerialObjectExpr(board, port);
    if (ser) return [`${ser}.read()`, Order.ATOMIC];
    if (board === 'arduino_uno' && port !== '0') {
      return ['0 /* Uno: use SoftwareSerial.read() on your instance */', Order.ATOMIC];
    }
    return ['0 /* secondary UART not generated */', Order.ATOMIC];
  };
  gen.forBlock['comm_serial_get_number'] = (block, g) => {
    void g;
    const port = safeFieldValue(block, 'SERPORT', '0');
    const ser = arduinoSerialObjectExpr(board, port);
    if (ser) return [`${ser}.parseInt()`, Order.ATOMIC];
    if (board === 'arduino_uno' && port !== '0') {
      return ['0 /* Uno: use ss.parseInt() on SoftwareSerial */', Order.ATOMIC];
    }
    return ['0', Order.ATOMIC];
  };
  gen.forBlock['comm_serial_read_string'] = (block, g) => {
    void g;
    const port = safeFieldValue(block, 'SERPORT', '0');
    const ser = arduinoSerialObjectExpr(board, port);
    if (ser) return [`${ser}.readString()`, Order.ATOMIC];
    if (board === 'arduino_uno' && port !== '0') {
      return ['String() /* Uno: use ss.readString() */', Order.ATOMIC];
    }
    return ['String()', Order.ATOMIC];
  };
  gen.forBlock['comm_serial_write_text'] = (block, g) => {
    void g;
    const line = mblockCStr(safeFieldValue(block, 'LINE', ''));
    const port = safeFieldValue(block, 'SERPORT', '0');
    const ser = arduinoSerialObjectExpr(board, port);
    if (ser) return `${ser}.println("${line}");\n`;
    if (board === 'arduino_uno' && port !== '0') {
      return `// Uno: ss.println("${line}") on your SoftwareSerial instance\n`;
    }
    return `// Serial ${port}.println("${line}") — init UART first\n`;
  };

  const dabbleComment = (text) => `// Dabble / app module: ${text}\n`;
  gen.forBlock['dabble_enable_servo'] = () =>
    dabbleComment('enable servo — use output servo blocks with real GPIO wiring');
  gen.forBlock['dabble_enable_motor'] = gen.forBlock['mblock_motor_connect'];
  gen.forBlock['dabble_tactile_pressed'] = (block, g) => {
    void g;
    const pin = digitalPinLiteral(block, board, 'SW', 2);
    return [`(digitalRead(${pin}) == HIGH)`, Order.ATOMIC];
  };
  gen.forBlock['dabble_slide_switch'] = (block, g) => {
    void g;
    const pin = digitalPinLiteral(block, board, 'SW', 2);
    const left = safeFieldValue(block, 'POS', 'LEFT') === 'LEFT';
    return [`(digitalRead(${pin}) == ${left ? 'LOW' : 'HIGH'})`, Order.ATOMIC];
  };
  gen.forBlock['dabble_pot_value'] = (block, g) => {
    void g;
    void fieldNumberBlock(block, 'PID', 1, 1, 4);
    return [`analogRead(A0) /* pot ID field — wire to an analog pin & use read analog */`, Order.ATOMIC];
  };
  gen.forBlock['dabble_phone_accel'] = () => [
    '0 /* phone accelerometer — not on device; use IMU block if present */',
    Order.ATOMIC,
  ];
  gen.forBlock['dabble_camera_setup'] = (block, g) => {
    void g;
    return dabbleComment(
      `camera flash ${safeFieldValue(block, 'FLASH', 'ON')} quality ${safeFieldValue(block, 'QUAL', 'HIGH')} zoom ${safeFieldValue(block, 'ZOOM', '0')}`,
    );
  };
  gen.forBlock['dabble_camera_rotate'] = (block, g) => {
    void g;
    return dabbleComment(`rotate camera ${safeFieldValue(block, 'SIDE', 'REAR')}`);
  };
  gen.forBlock['dabble_camera_capture'] = () => dabbleComment('capture image');
  gen.forBlock['dabble_color_grid'] = () => dabbleComment('color detector grid setup');
  gen.forBlock['dabble_color_cell'] = () => ['0 /* color cell */', Order.ATOMIC];
  gen.forBlock['dabble_bt_name'] = (block, g) => {
    void g;
    return dabbleComment(`BT name ${mblockCStr(safeFieldValue(block, 'NM', ''))}`);
  };
  gen.forBlock['dabble_refresh'] = () => dabbleComment('refresh Dabble data');
  gen.forBlock['dabble_led_control'] = () => dabbleComment('enable LED brightness via app');
  gen.forBlock['dabble_terminal_has_data'] = (block, g) => {
    void g;
    void mblockCStr(safeFieldValue(block, 'TOK', ''));
    return ['(Serial.available() > 0)', Order.ATOMIC];
  };
  gen.forBlock['dabble_terminal_number'] = () => ['Serial.parseFloat()', Order.ATOMIC];
  gen.forBlock['dabble_terminal_send'] = (block, g) => {
    void g;
    const line = mblockCStr(safeFieldValue(block, 'LINE', ''));
    return `Serial.println("${line}");\n`;
  };
  gen.forBlock['dabble_gamepad_pressed'] = () => ['false /* gamepad via Dabble app */', Order.ATOMIC];
  gen.forBlock['dabble_gamepad_value'] = () => ['0 /* gamepad value */', Order.ATOMIC];
  gen.forBlock['dabble_pin_monitor'] = () => dabbleComment('pin state monitor (host UI)');
}

/**
 * @param {BoardId} board
 */
export function createArduinoGenerator(board) {
  const gen = new CodeGenerator('Arduino');
  gen.addReservedWords(
    'setup,loop,HIGH,LOW,INPUT,OUTPUT,INPUT_PULLUP,pinMode,digitalWrite,digitalRead,analogRead,analogWrite,delay,delayMicroseconds,tone,noTone,pulseIn,map,constrain,random,abs,sqrt,log,exp,sin,cos,tan,asin,acos,atan,pow,PI,SERIAL,Serial,String,true,false',
  );
  registerStandardAndHardware(gen, board);
  installSafeValueAndStatementWrappers(gen);
  installSafeBlockToCodeWrapper(gen);
  installSafeWorkspaceToCode(gen);
  return gen;
}

/**
 * @param {import('blockly/core/workspace').Workspace} workspace
 * @param {BoardId} board
 */
function fallbackSketch(board, note) {
  const boardTitle = board === 'esp32' ? 'ESP32 (Arduino framework)' : 'Arduino Uno';
  return `/*
 * ${boardTitle} — hardware block IDE (upload mode)
 */
// ${note}

void setup() {
  // — When board starts — stack blocks generate this section.
  Serial.begin(9600);
}

void loop() {
  // — Main loop — place sensing & actuation here, or use “repeat forever”.
}
`;
}

export function buildSketch(workspace, board) {
  const safeBoard = board === 'esp32' ? 'esp32' : 'arduino_uno';
  if (!workspace || typeof workspace.getAllBlocks !== 'function') {
    return fallbackSketch(safeBoard, 'Workspace not ready.');
  }

  let gen;
  try {
    gen = createArduinoGenerator(safeBoard);
    gen.init(workspace);
    // Base CodeGenerator.init does not create nameDB_; provideFunction_ / getVariableName need it.
    gen.nameDB_ = new Names(gen.RESERVED_WORDS_);
    gen.nameDB_.setVariableMap(workspace.getVariableMap());
    gen.nameDB_.populateVariables(workspace);
    gen.nameDB_.populateProcedures(workspace);
  } catch (e) {
    console.warn('[codegen] init', e);
    return fallbackSketch(safeBoard, `Generator init: ${String(e?.message || e)}`);
  }

  for (const block of workspace.getTopBlocks(true)) {
    const t = block?.type;
    if (t === 'procedures_defnoreturn' || t === 'procedures_defreturn') {
      try {
        gen.blockToCode(block);
      } catch {
        /* definitions filled best-effort */
      }
    }
  }

  let setupRaw = '';
  let loopRaw = '';
  try {
    const { setup, loopFromHat } = partitionBoardStartsChains(gen, workspace);
    setupRaw = setup;
    const orphanLoop = collectOrphanLoopStatementCode(gen, workspace);
    loopRaw = [loopFromHat, orphanLoop].filter((s) => s && String(s).trim()).join('\n');
  } catch (e) {
    console.warn('[codegen/setup-loop partition]', e);
    setupRaw = '';
    loopRaw = `// setup/loop partition failed: ${String(e?.message || e)}\n`;
  }

  let helpersAndDefs = '';
  try {
    helpersAndDefs = Object.values(gen.definitions_)
      .filter((s) => typeof s === 'string' && s.trim())
      .join('\n');
  } catch {
    helpersAndDefs = '';
  }

  let decl = '';
  try {
    const vars = Variables.allUsedVarModels(workspace) || [];
    decl = vars
      .map((v) => {
        try {
          return `float ${gen.getVariableName(v.getId())} = 0;`;
        } catch {
          return '// (variable declaration skipped)';
        }
      })
      .join('\n');
  } catch {
    decl = '';
  }

  const boardTitle = safeBoard === 'esp32' ? 'ESP32 (Arduino framework)' : 'Arduino Uno';
  const IND = gen.INDENT;

  const declBlock = decl ? `${IND}// — Workspace variables —\n${indentLines(decl, IND)}\n` : '';

  const setupUser = setupRaw ? `${IND}// — When board starts —\n${indentLines(setupRaw, IND)}\n` : '';

  const serialGuardSource = `${setupRaw}\n${decl}`;
  const defaultSerial = needsDefaultSerialBegin(serialGuardSource)
    ? `${IND}// — USB Serial (default baud) —\n${IND}Serial.begin(9600);\n`
    : '';

  const setupInner = `${declBlock}${setupUser}${defaultSerial}` || `${IND}// (empty setup)\n${defaultSerial}`;

  const loopInner = loopRaw
    ? `${IND}// — Main loop —\n${indentLines(loopRaw, IND)}\n`
    : `${IND}// — Main loop —\n${IND}// Drag blocks here or use “repeat forever” / “while true”.\n`;

  try {
    return `/*
 * ${boardTitle} — hardware block IDE (upload mode)
 * Check pins, supply current, and any extra #include / libraries noted in comments.
 */
${safeBoard === 'esp32' ? '// Board: ESP32 (Arduino-ESP32 core)\n' : '// Board: Arduino Uno-class (ATmega328P)\n'}
${helpersAndDefs}

void setup() {
${setupInner}
}

void loop() {
${loopInner}
}
`;
  } catch (e) {
    console.warn('[codegen] assemble sketch', e);
    return fallbackSketch(safeBoard, String(e?.message || e));
  }
}

/** @param {import('blockly/core/workspace').Workspace} workspace */
export function buildArduinoUnoSketch(workspace) {
  return buildSketch(workspace, 'arduino_uno');
}
