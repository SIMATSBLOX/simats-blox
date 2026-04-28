import { CodeGenerator, Variables } from 'blockly/core';

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

/** A0–A5 style labels → common ADC1 GPIOs on many ESP32 DevKit boards */
const ESP32_ANALOG_GPIO = Object.freeze({
  A0: 36,
  A1: 39,
  A2: 34,
  A3: 35,
  A4: 32,
  A5: 33,
});

/** ESP32 ADC1-capable GPIOs (WiFi on — use only these for analogRead-style blocks). */
const ESP32_ADC1_GPIO = new Set([32, 33, 34, 35, 36, 39]);

/** ESP32 (classic WROOM/WROVER) touch-capable GPIOs — see MicroPython ESP32 quickref. */
const ESP32_TOUCH_PAD_CLASSIC = new Set([0, 2, 4, 12, 13, 14, 15, 27, 32, 33]);

function noteInvalidTouchPad(gen, requested, use) {
  const nk = `%mp_touch_pad_note_${requested}`;
  if (gen.definitions_[nk]) return;
  gen.definitions_[nk] =
    `# Touch: GPIO ${requested} is not a touch pad on ESP32 (pads: 0,2,4,12–15,27,32,33). Using ${use}.\n`;
}

/**
 * TouchPad GPIO from a Blockly numeric pin field (invalid → 14 + comment).
 * @param {import('blockly/core/generator').CodeGenerator} gen
 * @param {import('blockly/core/block').Block} block
 */
function touchGpioFromBlock(gen, block, fieldName, def) {
  const requested = digitalGpio(block, fieldName, def);
  if (ESP32_TOUCH_PAD_CLASSIC.has(requested)) return requested;
  const n = 14;
  noteInvalidTouchPad(gen, requested, n);
  return n;
}

/**
 * TouchPad GPIO from a raw number (labeled blocks). Invalid → 14 + comment.
 * @param {import('blockly/core/generator').CodeGenerator} gen
 */
function touchGpioNumber(gen, raw) {
  const r = Number(raw);
  const requested = Number.isFinite(r) ? clampInt(r, 0, 39) : 14;
  if (ESP32_TOUCH_PAD_CLASSIC.has(requested)) return requested;
  const n = 14;
  noteInvalidTouchPad(gen, requested, n);
  return n;
}

/**
 * Numeric APIN field → valid ADC1 GPIO (invalid pins e.g. 21 map to 34).
 * @param {import('blockly/core/block').Block} block
 * @param {string} fieldName
 * @param {number} fallback
 */
function adcGpioFromBlock(block, fieldName, fallback) {
  const n = fieldNumberBlock(block, fieldName, fallback, 0, 39);
  if (ESP32_ADC1_GPIO.has(n)) return n;
  return 34;
}

/** MicroPython expression: ADC raw 0–4095 → percent 0–100 (float). */
function adcReadPercentExpr(gpio) {
  return `(adc${gpio}.read() / 4095.0 * 100.0)`;
}

function safeFieldValue(block, name, fallback = '') {
  try {
    const f = block?.getFieldValue?.(name);
    return f !== undefined && f !== null ? String(f) : fallback;
  } catch {
    return fallback;
  }
}

function stripInlinePyComment(expr) {
  return String(expr || '0').replace(/\s+#.*$/u, '').trim() || '0';
}

function ensureSuiteOrFallback(code, fallbackLine = 'pass') {
  const txt = String(code || '');
  if (txt.trim()) return txt;
  return `    ${fallbackLine}\n`;
}

function clampInt(n, lo, hi) {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
}

function fieldNumberBlock(block, name, fallback, min, max) {
  const raw = Number(safeFieldValue(block, name, String(fallback)));
  const base = Number.isFinite(raw) ? raw : fallback;
  return clampInt(base, min, max);
}

function digitalGpio(block, fieldName, def) {
  return fieldNumberBlock(block, fieldName, def, 0, 39);
}

/**
 * @param {import('blockly/core/workspace').Workspace | null | undefined} ws
 * @param {string} midKey
 * @returns {{ d1: number, d2: number, pwm: number } | null}
 */
function lookupMblockMotorPinsMpy(ws, midKey) {
  if (!ws || typeof ws.getAllBlocks !== 'function') return null;
  const want = String(midKey);
  try {
    for (const b of ws.getAllBlocks(false)) {
      if (!b || b.isDisposed() || b.type !== 'mblock_motor_connect') continue;
      const cmid = String(fieldNumberBlock(b, 'MID', 1, 1, 4));
      if (cmid !== want) continue;
      return {
        d1: digitalGpio(b, 'D1', 2),
        d2: digitalGpio(b, 'D2', 4),
        pwm: digitalGpio(b, 'PWM', 5),
      };
    }
  } catch {
    return null;
  }
  return null;
}

function dhtMpyId(pin, typ) {
  return `p${pin}_${typ}`.replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * @param {import('blockly/core/generator').CodeGenerator} gen
 */
function ensureMpyDht(gen, pin, typ) {
  const id = dhtMpyId(pin, typ);
  const key = `%mpy_dht_${id}`;
  if (!gen.definitions_[key]) {
    ensureImp(gen, 'import dht');
    ensureImp(gen, 'from machine import Pin');
    const cls = typ === 'DHT22' ? 'DHT22' : 'DHT11';
    // DHT11 needs ~1 s between samples; DHT22 is faster. Never call measure() twice inside min_ms.
    const minMs = typ === 'DHT22' ? 550 : 1100;
    gen.definitions_[key] = `
# DHT ${typ} on GPIO ${pin}: one measure() per >=${minMs}ms; temp+humidity in one loop share the same (_t,_h).
_hw_dht_${id} = dht.${cls}(Pin(${pin}))
_hw_dht_buf_${id} = (float('nan'), float('nan'))
_hw_dht_last_ms_${id} = -1

def _hw_dht_pair_${id}():
    global _hw_dht_buf_${id}, _hw_dht_last_ms_${id}
    now = time.ticks_ms()
    if _hw_dht_last_ms_${id} >= 0:
        dt = time.ticks_diff(now, _hw_dht_last_ms_${id})
        if dt >= 0 and dt < ${minMs}:
            return _hw_dht_buf_${id}
    try:
        _hw_dht_${id}.measure()
        t = float(_hw_dht_${id}.temperature())
        h = float(_hw_dht_${id}.humidity())
        if (t != t) or (h != h):
            _hw_dht_buf_${id} = (float('nan'), float('nan'))
        else:
            _hw_dht_buf_${id} = (t, h)
    except OSError:
        _hw_dht_buf_${id} = (float('nan'), float('nan'))
    _hw_dht_last_ms_${id} = now
    return _hw_dht_buf_${id}
`;
  }
}

/**
 * Value block feeding Serial print — DHT temp or humidity (mblock or legacy blocks).
 * @param {import('blockly/core/block').Block | null} block
 * @returns {{ pin: number; typ: string; role: 'temp' | 'hum' } | null}
 */
function dhtValueBlockSpec(block) {
  if (!block) return null;
  try {
    if (block.type === 'sensor_dht_mblock') {
      const pin = digitalGpio(block, 'DPIN', 2);
      const typ = safeFieldValue(block, 'TYPE', 'DHT11');
      const fld = safeFieldValue(block, 'DHTFIELD', 'TEMP');
      return { pin, typ, role: fld === 'HUM' ? 'hum' : 'temp' };
    }
    if (block.type === 'sensor_dht_temp') {
      return {
        pin: digitalGpio(block, 'DPIN', 2),
        typ: safeFieldValue(block, 'TYPE', 'DHT11'),
        role: 'temp',
      };
    }
    if (block.type === 'sensor_dht_humidity') {
      return {
        pin: digitalGpio(block, 'DPIN', 2),
        typ: safeFieldValue(block, 'TYPE', 'DHT11'),
        role: 'hum',
      };
    }
  } catch {
    return null;
  }
  return null;
}

/** @param {{ pin: number; typ: string; role: string } | null} a */
function dhtSpecsMatchPinsAndType(a, b) {
  return Boolean(a && b && a.pin === b.pin && a.typ === b.typ);
}

/**
 * This println’s code was folded into the previous TEMP println (Devices serial bridge format).
 * @param {import('blockly/core/block').Block} block
 */
function isDhtSerialBridgeMergeFollower(block) {
  const prev = block.getPreviousBlock();
  if (!prev || prev.type !== 'comm_serial_println') return false;
  const a = dhtValueBlockSpec(prev.getInputTargetBlock('VAL'));
  const b = dhtValueBlockSpec(block.getInputTargetBlock('VAL'));
  if (!dhtSpecsMatchPinsAndType(a, b)) return false;
  return (
    (a.role === 'temp' && b.role === 'hum') ||
    (a.role === 'hum' && b.role === 'temp')
  );
}

/**
 * Two chained printlns: DHT temp+hum (either order) → one line for parseSerialLineToReading (dht11).
 * @param {import('blockly/core/block').Block} block
 * @param {import('blockly/core/generator').CodeGenerator} gen
 */
function tryEmitMicropythonDhtSerialBridgePrintln(block, gen) {
  const a = dhtValueBlockSpec(block.getInputTargetBlock('VAL'));
  if (!a) return null;
  const next = block.getNextBlock();
  if (!next || next.type !== 'comm_serial_println') return null;
  const b = dhtValueBlockSpec(next.getInputTargetBlock('VAL'));
  if (!b || !dhtSpecsMatchPinsAndType(a, b)) return null;
  if (!((a.role === 'temp' && b.role === 'hum') || (a.role === 'hum' && b.role === 'temp'))) return null;
  try {
    ensureMpyDht(gen, a.pin, a.typ);
  } catch {
    return null;
  }
  const id = dhtMpyId(a.pin, a.typ);
  return `_dht_br = _hw_dht_pair_${id}()\nprint("Humidity: {:.2f} % Temperature: {:.2f} °C".format(_dht_br[1], _dht_br[0]))\n`;
}

/**
 * One println with only DHT temp or humidity → still emit full labeled line (one measure()).
 * @param {import('blockly/core/block').Block} block
 * @param {import('blockly/core/generator').CodeGenerator} gen
 */
function tryMicropythonDhtSingleFullLinePrintln(block, gen) {
  const vb = block.getInputTargetBlock('VAL');
  if (!vb) return null;
  const spec = dhtValueBlockSpec(vb);
  if (!spec || (spec.role !== 'temp' && spec.role !== 'hum')) return null;
  const next = block.getNextBlock();
  if (next && next.type === 'comm_serial_println') {
    const b = dhtValueBlockSpec(next.getInputTargetBlock('VAL'));
    if (b && dhtSpecsMatchPinsAndType(spec, b) && spec.role !== b.role) return null;
  }
  try {
    ensureMpyDht(gen, spec.pin, spec.typ);
  } catch {
    return null;
  }
  const id = dhtMpyId(spec.pin, spec.typ);
  return `_dht_br = _hw_dht_pair_${id}()\nprint("Humidity: {:.2f} % Temperature: {:.2f} °C".format(_dht_br[1], _dht_br[0]))\n`;
}

/**
 * Single println(sensor) → one labeled line for Devices serial bridge.
 * @param {import('blockly/core/block').Block} block
 * @param {import('blockly/core/generator').CodeGenerator} gen
 */
function tryMicropythonLabeledSensorPrintln(block, gen) {
  const vb = block.getInputTargetBlock('VAL');
  if (!vb) return null;
  const code = stripInlinePyComment(gen.valueToCode(block, 'VAL', Order.NONE) || '0');
  const t = vb.type;
  if (t === 'sensor_ultrasonic_cm' || t === 'sensor_ultrasonic_mblock') {
    return `print("Distance: {:.2f} cm".format(${code}))\n`;
  }
  if (t === 'sensor_soil') {
    return `print("Moisture: {:.2f} %".format(float(${code})))\n`;
  }
  if (t === 'sensor_ldr') {
    return `print("Light level: {}".format(int(round(float(${code})))))\n`;
  }
  if (t === 'sensor_gas') {
    return `print("Gas level: {}".format(int(round(float(${code})))))\n`;
  }
  if (t === 'sensor_analog_mblock') {
    const tag = safeFieldValue(vb, 'ASTYPE', 'LDR');
    if (tag === 'SOIL') {
      return `print("Moisture: {:.2f} %".format(float(${code})))\n`;
    }
    if (tag === 'GAS') {
      return `print("Gas level: {}".format(int(round(float(${code})))))\n`;
    }
    if (tag === 'RAIN') {
      return `print("Rain level: {}".format(int(round(float(${code})))))\n`;
    }
    return `print("Light level: {}".format(int(round(float(${code})))))\n`;
  }
  if (t === 'sensor_bmp280_mblock') {
    return `print("BMP280 not supported")\n`;
  }
  if (t === 'mp_touch_read') {
    return `print("Touch: {}".format(int(${code})))\n`;
  }
  if (t === 'touch_module_read') {
    return `print("Detection: {}".format(1 if ${code} else 0))\n`;
  }
  if (t === 'sensor_digital_mblock' || t === 'input_pir_read') {
    return `print("Detection: {}".format(1 if ${code} else 0))\n`;
  }
  if (t === 'input_ir_read') {
    return `print("IR level: {}".format(int(${code})))\n`;
  }
  return null;
}

function apinToGpio(block) {
  const label = safeFieldValue(block, 'APIN', 'A0').trim();
  const g = ESP32_ANALOG_GPIO[label];
  if (g !== undefined) return g;
  const m = /^A([0-5])$/.exec(label);
  if (m) return ESP32_ANALOG_GPIO[`A${m[1]}`] ?? 36;
  return 36;
}

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

/** Blockly “repeat N times” with ∞ from math_constant — must not become range(inf) in setup. */
function repeatExtHasInfiniteTimes(block) {
  try {
    if (!block || block.type !== 'controls_repeat_ext') return false;
    const ch = block.getInputTargetBlock('TIMES');
    if (!ch || ch.type !== 'math_constant') return false;
    return safeFieldValue(ch, 'CONSTANT', '') === 'INFINITY';
  } catch {
    return false;
  }
}

/** No TIMES wired — range(0) would run zero times; treat like a continuous loop body under the hat. */
function repeatExtTimesInputDisconnected(block) {
  try {
    if (!block || block.type !== 'controls_repeat_ext') return false;
    const input = block.getInput('TIMES');
    const c = input?.connection;
    if (!c) return true;
    return !c.targetConnection();
  } catch {
    return false;
  }
}

function indentPy(code, indent) {
  if (!code || !String(code).trim()) return '';
  return String(code)
    .trimEnd()
    .split('\n')
    .map((ln) => (ln.length ? indent + ln : ''))
    .join('\n');
}

/** Strip the shortest common leading space count so nested loop bodies are not indented twice in def loop(). */
function dedentCommonLeadingWhitespace(code) {
  const raw = String(code ?? '');
  const lines = raw.split('\n');
  const leads = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const m = /^ */.exec(line);
    leads.push(m ? m[0].length : 0);
  }
  if (leads.length === 0) return raw.trimEnd();
  const min = Math.min(...leads);
  if (min === 0) return raw.trimEnd();
  return lines
    .map((line) => {
      if (!line.trim()) return '';
      return line.length >= min ? line.slice(min) : line;
    })
    .join('\n')
    .trimEnd();
}

/** True if indented block has at least one non-comment, non-blank line (Python requires a real suite after `:`). */
function mpyBlockHasExecutableLine(indentedMultiline) {
  const lines = String(indentedMultiline || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return false;
  return lines.some((l) => !l.startsWith('#'));
}

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
          let inner = generator.statementToCode(b, 'DO') || '';
          inner = dedentCommonLeadingWhitespace(inner);
          if (inner.trim()) hatLoopChunks.push(inner.trimEnd());
        } catch {
          hatLoopChunks.push('# (repeat forever body skipped)\n');
        }
        b = b.getNextBlock();
        continue;
      }

      if (t === 'controls_whileUntil' && isForeverWhileBlock(b)) {
        try {
          let inner = generator.statementToCode(b, 'DO') || '';
          inner = dedentCommonLeadingWhitespace(inner);
          if (inner.trim()) hatLoopChunks.push(inner.trimEnd());
        } catch {
          hatLoopChunks.push('# (while True body skipped)\n');
        }
        b = b.getNextBlock();
        continue;
      }

      if (
        t === 'controls_repeat_ext' &&
        (repeatExtHasInfiniteTimes(b) || repeatExtTimesInputDisconnected(b))
      ) {
        try {
          let inner = generator.statementToCode(b, 'DO') || '';
          inner = dedentCommonLeadingWhitespace(inner);
          if (inner.trim()) hatLoopChunks.push(inner.trimEnd());
        } catch {
          hatLoopChunks.push('# (repeat body skipped)\n');
        }
        b = b.getNextBlock();
        continue;
      }

      try {
        const fn = generator.forBlock?.[t];
        const code = typeof fn === 'function' ? fn(b, generator) : generator.blockToCode(b);
        if (code && typeof code === 'string' && code.trim()) {
          setupChunks.push(code.trimEnd());
        }
      } catch {
        setupChunks.push('# (block skipped in setup)\n');
      }
      b = b.getNextBlock();
    }
  }

  return {
    setup: setupChunks.join('\n'),
    loopFromHat: hatLoopChunks.join('\n'),
  };
}

function collectOrphanLoopStatementCode(generator, workspace) {
  const chunks = [];
  const skip = new Set(['procedures_defnoreturn', 'procedures_defreturn', 'board_when_starts', 'esp32_when_starts']);

  for (const block of workspace.getTopBlocks(true)) {
    if (!block || block.isDisposed()) continue;
    if (skip.has(block.type)) continue;

    try {
      let code = generator.blockToCode(block);
      if (code && typeof code === 'string' && code.trim()) {
        code = dedentCommonLeadingWhitespace(code);
        chunks.push(code.trimEnd());
      }
    } catch {
      /* ignore */
    }
  }
  return chunks.join('\n');
}

function ensureImp(gen, line) {
  const k = `%imp_${line.replace(/\W/g, '_')}`;
  if (!gen.definitions_[k]) gen.definitions_[k] = `${line}\n`;
}

function ensureSsd1306Import(gen) {
  ensureImp(gen, 'import ssd1306');
}

function ensurePinOut(gen, n) {
  ensurePinMode(gen, n, 'OUT', 'Pin.OUT');
}

function ensurePinIn(gen, n) {
  ensurePinMode(gen, n, 'IN', 'Pin.IN');
}

function ensurePinInPullUp(gen, n) {
  ensurePinMode(gen, n, 'IN_PULLUP', 'Pin.IN, Pin.PULL_UP');
}

function ensurePinMode(gen, n, modeKey, modeExpr) {
  const k = `%mp_pin_${n}`;
  if (!gen.__mpPinModes) gen.__mpPinModes = {};
  const existing = gen.__mpPinModes[n];
  if (existing && existing !== modeKey) return;
  if (existing === modeKey && gen.definitions_[k]) return;
  gen.__mpPinModes[n] = modeKey;
  gen.definitions_[k] = `pin${n} = Pin(${n}, ${modeExpr})\n`;
}

function ensureAdc(gen, gpio) {
  const k = `%mp_adc_${gpio}`;
  if (gen.definitions_[k]) return;
  gen.definitions_[k] = `adc${gpio} = ADC(Pin(${gpio}))\nadc${gpio}.atten(ADC.ATTN_11DB)\n`;
}

function ensureTouch(gen, n) {
  const k = `%mp_touch_${n}`;
  const hk = '%mp_touch_helper';
  if (!gen.definitions_[hk]) {
    gen.definitions_[hk] = `
def _hw_touch_raw(_tp):
    # Touch FSM / first samples can fail briefly after init (ESP-IDF); retry reads and bogus values.
    for attempt in range(16):
        try:
            _v = _tp.read()
            if _v is None:
                raise ValueError("touch read None")
            _iv = int(_v)
            if _iv >= 0:
                return _iv
        except Exception:
            pass
        try:
            time.sleep_ms(2 + (attempt if attempt < 6 else 6))
        except Exception:
            pass
    return -1

def _hw_touch_read(_tp):
    return _hw_touch_raw(_tp)

def _hw_touch_active_value(_tp, _th):
    _v = _hw_touch_raw(_tp)
    if _v < 0:
        return 0
    return _v if _v < int(_th) else 0
`;
  }
  if (gen.definitions_[k]) return;
  gen.definitions_[k] = `touch${n} = TouchPad(Pin(${n}))\n`;
  const wk = '%mp_touch_post_init_delay';
  if (!gen.definitions_[wk]) {
    gen.definitions_[wk] =
      'try:\n    time.sleep_ms(100)\nexcept Exception:\n    pass\n';
  }
}

function ensurePwm(gen, n, freq) {
  const k = `%mp_pwm_${n}`;
  if (!gen.definitions_[k]) {
    gen.definitions_[k] = `pwm${n} = PWM(Pin(${n}), freq=${freq})\n`;
  }
}

function ensureNeoPixel(gen, n, count) {
  ensureImp(gen, 'import neopixel');
  ensureImp(gen, 'from machine import Pin');
  const px = clampInt(count, 1, 300);
  const key = '%mp_neopixel_setup';
  if (!gen.definitions_[key]) {
    gen.definitions_[key] =
      `NP_PIN = ${n}\n` +
      `NP_COUNT = ${px}\n` +
      `# Free the pin from PWM (e.g. GPIO18 = VSPI SCK on many ESP32 boards) so NeoPixel/RMT can drive it\n` +
      `try:\n` +
      `    PWM(Pin(NP_PIN), freq=1000).deinit()\n` +
      `except Exception:\n` +
      `    pass\n` +
      `_np_pin = Pin(NP_PIN, Pin.OUT)\n` +
      `try:\n` +
      `    time.sleep_ms(30)\n` +
      `except Exception:\n` +
      `    pass\n` +
      `try:\n` +
      `    np = neopixel.NeoPixel(_np_pin, NP_COUNT, timing=1)\n` +
      `except TypeError:\n` +
      `    np = neopixel.NeoPixel(_np_pin, NP_COUNT)\n` +
      `try:\n` +
      `    for _npz in range(NP_COUNT):\n` +
      `        np[_npz] = (0, 0, 0)\n` +
      `    np.write()\n` +
      `except Exception:\n` +
      `    pass\n` +
      `try:\n` +
      `    print("NeoPixel pin=%d count=%d" % (NP_PIN, NP_COUNT))\n` +
      `except Exception:\n` +
      `    pass\n`;
  }
}

function ensureMax30102Helper(gen, sda, scl) {
  const pinSda = clampInt(sda, 0, 39);
  const pinScl = clampInt(scl, 0, 39);
  const defs = gen.definitions_;
  defs['%mp_max30102_setup'] =
    `MAX30102_SDA = ${pinSda}\n` +
    `MAX30102_SCL = ${pinScl}\n` +
    `MAX30102_ADDR = 0x57\n` +
    `max30102_i2c = None\n` +
    `max30102_bus_id = -1\n` +
    `# Polling mode: INT pin not used.\n`;
  if (!defs['%mp_max30102_helper']) {
    defs['%mp_max30102_helper'] = `
_max30102_baseline = None
_max30102_noise = 400.0
_max30102_was_high = False
_max30102_last_beat_ms = 0
_max30102_bpm = 0.0
_max30102_rates = [0, 0, 0, 0]
_max30102_rate_spot = 0
_max30102_avg = 0

def _max30102_open_i2c():
    global max30102_i2c, max30102_bus_id
    for _bus_id in (0, 1):
        try:
            _bus = I2C(_bus_id, scl=Pin(MAX30102_SCL), sda=Pin(MAX30102_SDA), freq=400000)
            _bus.scan()
            max30102_i2c = _bus
            max30102_bus_id = _bus_id
            return True
        except Exception:
            continue
    max30102_i2c = None
    max30102_bus_id = -1
    return False

def max30102_scan():
    try:
        if max30102_i2c is None and not _max30102_open_i2c():
            return []
        return max30102_i2c.scan()
    except Exception:
        return []

def _max30102_write(reg, val):
    max30102_i2c.writeto_mem(MAX30102_ADDR, reg, bytes([val & 0xFF]))

def _max30102_read(reg, n=1):
    return max30102_i2c.readfrom_mem(MAX30102_ADDR, reg, n)

def max30102_init():
    try:
        if max30102_i2c is None and not _max30102_open_i2c():
            return False
        if MAX30102_ADDR not in max30102_scan():
            return False
        _max30102_write(0x09, 0x40)  # mode config reset
        time.sleep_ms(20)
        _max30102_write(0x04, 0x00)  # FIFO_WR_PTR reset
        _max30102_write(0x05, 0x00)  # OVF_COUNTER reset
        _max30102_write(0x06, 0x00)  # FIFO_RD_PTR reset
        _max30102_write(0x08, 0x4F)  # FIFO config: sample avg + rollover
        _max30102_write(0x09, 0x03)  # SpO2 mode (RED + IR)
        _max30102_write(0x0A, 0x27)  # SPO2 config: 100 Hz, 411 us, ADC range
        _max30102_write(0x0C, 0x3F)  # LED1 pulse amplitude (RED)
        _max30102_write(0x0D, 0x3F)  # LED2 pulse amplitude (IR)
        _max30102_write(0x02, 0x00)  # clear interrupts
        _max30102_write(0x03, 0x00)
        time.sleep_ms(30)
        return True
    except OSError:
        return False

def max30102_read_raw():
    try:
        wr = _max30102_read(0x04)[0]  # FIFO_WR_PTR
        rd = _max30102_read(0x06)[0]  # FIFO_RD_PTR
        # Some breakout/module variants keep pointers equal while still returning valid FIFO bytes.
        # Try reading one sample anyway and only report None on all-zero payload.
        d = _max30102_read(0x07, 6)   # FIFO_DATA (RED[3], IR[3])
        red = ((d[0] << 16) | (d[1] << 8) | d[2]) & 0x03FFFF
        ir = ((d[3] << 16) | (d[4] << 8) | d[5]) & 0x03FFFF
        if wr == rd and red == 0 and ir == 0:
            return None
        return (ir, red)
    except OSError:
        return None

def max30102_pulse_reading():
    global _max30102_baseline, _max30102_noise, _max30102_was_high
    global _max30102_last_beat_ms, _max30102_bpm, _max30102_rates, _max30102_rate_spot, _max30102_avg
    _m = max30102_read_raw()
    if _m is None:
        return (0, _max30102_bpm, _max30102_avg)
    _ir = int(_m[0])
    if _max30102_baseline is None:
        _max30102_baseline = float(_ir)
        return (_ir, _max30102_bpm, _max30102_avg)
    _max30102_baseline = (_max30102_baseline * 0.95) + (_ir * 0.05)
    _ac = float(_ir) - _max30102_baseline
    _abs_ac = abs(_ac)
    _max30102_noise = (_max30102_noise * 0.94) + (_abs_ac * 0.06)
    # Reflective PPG often shows systole as an IR *dip* (negative AC). Use inverted
    # peak so one edge detector works; keep floor low so small pleth swings still count.
    _dc = max(1.0, abs(float(_ir)))
    _th = max(45.0, _max30102_noise * 1.85, _dc * 0.00012)
    _sig = -_ac
    _high = _sig > _th
    _now = time.ticks_ms()
    if _high and (not _max30102_was_high):
        if _max30102_last_beat_ms > 0:
            _delta = time.ticks_diff(_now, _max30102_last_beat_ms)
            if 280 <= _delta <= 4000:
                _bpm = 60000.0 / _delta
                if 15.0 < _bpm < 220.0:
                    _max30102_bpm = _bpm
                    _max30102_rates[_max30102_rate_spot] = int(_bpm)
                    _max30102_rate_spot = (_max30102_rate_spot + 1) % len(_max30102_rates)
                    _sum = 0
                    _cnt = 0
                    for _r in _max30102_rates:
                        if _r > 0:
                            _sum += _r
                            _cnt += 1
                    _max30102_avg = int(_sum / _cnt) if _cnt else 0
        _max30102_last_beat_ms = _now
    _max30102_was_high = _high
    return (_ir, _max30102_bpm, _max30102_avg)
`;
  }
}

function ensureServoHelper(gen) {
  const k = '%mp_servo_helper';
  if (gen.definitions_[k]) return;
  gen.definitions_[k] = `
_hw_servo_map = {}

def set_servo_angle(pin, angle):
    _p = int(pin)
    _a = int(angle)
    if _a < 0:
        _a = 0
    elif _a > 180:
        _a = 180
    _s = _hw_servo_map.get(_p)
    if _s is None:
        return
    _duty = int(26 + (_a / 180.0) * 102)
    _s.duty(_duty)
`;
}

function ensureServoPin(gen, n) {
  ensureServoHelper(gen);
  if (!gen.__mpServoSetupInit) gen.__mpServoSetupInit = {};
  if (gen.__mpServoSetupInit[n]) return;
  gen.__mpServoSetupInit[n] = `global servo${n}\nservo${n} = PWM(Pin(${n}), freq=50)\n_hw_servo_map[${n}] = servo${n}\n`;
}

/**
 * Stock ESP32 MicroPython has no `hcsr04` module on flash. Use machine.Pin +
 * machine.time_pulse_us so ultrasonic blocks work after main.py upload alone.
 */
function ensureMpyUltrasonicHelper(gen) {
  const k = '%mpy_ultra_cm_helper';
  if (gen.definitions_[k]) return;
  gen.definitions_[k] = `
def _hw_ultra_cm(trig_n, echo_n, timeout_us=30000):
    """HC-SR04-style distance (cm). Round-trip echo on echo_n; -1.0 on timeout."""
    _t = Pin(trig_n, Pin.OUT)
    _e = Pin(echo_n, Pin.IN)
    _t.value(0)
    time.sleep_us(4)
    _t.value(1)
    time.sleep_us(10)
    _t.value(0)
    try:
        _p = time_pulse_us(_e, 1, timeout_us)
    except AttributeError:
        raise RuntimeError(
            "Ultrasonic block needs machine.time_pulse_us — use a recent ESP32 MicroPython build (e.g. 1.14+)."
        )
    if _p < 0:
        return -1.0
    return _p / 58.0

`;
}

function regenControlsIfPy(block, generator) {
  try {
    let n = 0;
    let code = '';
    do {
      const cond = generator.valueToCode(block, `IF${n}`, Order.NONE) || 'False';
      let branch = ensureSuiteOrFallback(generator.statementToCode(block, `DO${n}`));
      code += (n === 0 ? 'if ' : 'elif ') + `${cond}:\n${branch}`;
      n++;
    } while (block.getInput(`IF${n}`));
    if (block.getInput('ELSE')) {
      const branch = ensureSuiteOrFallback(generator.statementToCode(block, 'ELSE'));
      code += `else:\n${branch}`;
    }
    return `${code}\n`;
  } catch {
    return '# Unsupported: if\n';
  }
}

function regenTextJoinPy(block, generator) {
  const raw = block.itemCount_;
  const count = typeof raw === 'number' && raw >= 0 ? raw : 2;
  if (count === 0) return ['""', Order.ATOMIC];
  const parts = [];
  for (let i = 0; i < count; i++) {
    const p = generator.valueToCode(block, `ADD${i}`, Order.ADDITIVE) || '""';
    parts.push(`str(${p})`);
  }
  if (parts.length === 1) return [parts[0], Order.ATOMIC];
  return [`(${parts.join(' + ')})`, Order.ADDITIVE];
}

function installSafeBlockToCodeWrapper(gen) {
  const original = gen.blockToCode.bind(gen);
  gen.blockToCode = function (block, opt_thisOnly) {
    if (!block) return '';
    const type = block.type || 'unknown';
    if (typeof gen.forBlock[type] !== 'function') {
      if (block.outputConnection) {
        return ['(float("nan"))', Order.ATOMIC];
      }
      return `# Unsupported block: ${type}\n`;
    }
    try {
      return original(block, opt_thisOnly);
    } catch (err) {
      console.warn('[mpy codegen] block', type, err);
      if (block.outputConnection) {
        return ['(float("nan"))', Order.ATOMIC];
      }
      return `# Error generating ${type}: ${String(err?.message || err)}\n`;
    }
  };
}

function installSafeValueAndStatementWrappers(gen) {
  const v0 = gen.valueToCode.bind(gen);
  gen.valueToCode = function (block, name, outerOrder) {
    try {
      if (!block) return '';
      const out = v0(block, name, outerOrder);
      return out === undefined || out === null ? '' : out;
    } catch (e) {
      console.warn('[mpy codegen] valueToCode', name, e);
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
      console.warn('[mpy codegen] statementToCode', name, e);
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
      console.warn('[mpy codegen] workspaceToCode', e);
      return `# workspaceToCode failed: ${String(e?.message || e)}\n`;
    }
  };
}

/**
 * Blockly's default CodeGenerator.scrub_ is identity; blockToCode never appends the next
 * statement in a stack. Python/JS generators override scrub_ — MicroPython must too or only
 * the first block (e.g. print) inside repeat-forever is generated.
 * @param {import('blockly/core/generator').CodeGenerator} gen
 */
function installMicroPythonScrub(gen) {
  gen.scrub_ = function (block, code, optThisOnly) {
    if (!block) return code ?? '';
    let prefix = '';
    try {
      if (!block.outputConnection || !block.outputConnection.targetConnection) {
        const note = block.getCommentText();
        if (note) {
          prefix += gen.prefixLines(`${note}\n`, '# ');
        }
      }
    } catch {
      /* */
    }
    const next =
      !optThisOnly && block.nextConnection && block.nextConnection.targetBlock()
        ? gen.blockToCode(block.nextConnection.targetBlock())
        : '';
    return prefix + code + next;
  };
}

function registerMicroPythonHardware(gen) {
  gen.forBlock['board_when_starts'] = () => '';
  gen.forBlock['esp32_when_starts'] = () => '';

  gen.forBlock['board_delay'] = (block, g) => {
    void g;
    const ms = fieldNumberBlock(block, 'MS', 1000, 0, 600000);
    return `time.sleep_ms(${ms})\n`;
  };

  gen.forBlock['board_pin_mode'] = (block, g) => {
    void g;
    const n = digitalGpio(block, 'DPIN', 2);
    const mode = safeFieldValue(block, 'MODE', 'OUTPUT');
    if (mode === 'INPUT_PULLUP') ensurePinInPullUp(gen, n);
    else if (mode === 'INPUT') ensurePinIn(gen, n);
    else ensurePinOut(gen, n);
    return '';
  };

  gen.forBlock['board_digital_write'] = (block, g) => {
    void g;
    const n = digitalGpio(block, 'DPIN', 13);
    const lv = safeFieldValue(block, 'LEVEL', 'LOW');
    const v = lv === 'HIGH' ? '1' : '0';
    if (!gen.definitions_[`%mp_pin_${n}`]) ensurePinOut(gen, n);
    return `pin${n}.value(${v})\n`;
  };

  gen.forBlock['board_digital_read'] = (block, g) => {
    void g;
    const n = digitalGpio(block, 'DPIN', 7);
    if (!gen.definitions_[`%mp_pin_${n}`]) ensurePinIn(gen, n);
    return [`pin${n}.value()`, Order.ATOMIC];
  };

  gen.forBlock['board_analog_read'] = (block, g) => {
    void g;
    const gpio = apinToGpio(block);
    ensureAdc(gen, gpio);
    return [`adc${gpio}.read()`, Order.ATOMIC];
  };

  gen.forBlock['board_analog_write'] = (block, g) => {
    void g;
    const n = digitalGpio(block, 'DPIN', 5);
    const raw = fieldNumberBlock(block, 'DUTY', 0, 0, 255);
    const duty = Math.min(1023, raw * 4);
    ensurePwm(gen, n, 1000);
    return `pwm${n}.duty(${duty})\n`;
  };

  gen.forBlock['board_serial_begin'] = () =>
    '# USB REPL: use print() — UART setup not emitted for this block\n';

  gen.forBlock['comm_serial_begin'] = gen.forBlock['board_serial_begin'];

  gen.forBlock['hw_wait'] = (block, g) => {
    void g;
    const ms = fieldNumberBlock(block, 'MS', 500, 0, 600000);
    return `time.sleep_ms(${ms})\n`;
  };

  gen.forBlock['hw_wait_until'] = (block, g) => {
    const c = g.valueToCode(block, 'COND', Order.NONE) || 'False';
    return `while not (${c}):\n${gen.INDENT}time.sleep_ms(1)\n`;
  };

  gen.forBlock['hw_forever'] = (block, g) => {
    try {
      return g.statementToCode(block, 'DO') || '';
    } catch {
      return '# Unsupported: repeat forever\n';
    }
  };

  gen.forBlock['hw_map_range'] = (block, g) => {
    const val = g.valueToCode(block, 'VAL', Order.NONE) || '0';
    const fl = g.valueToCode(block, 'FROM_LOW', Order.NONE) || '0';
    const fh = g.valueToCode(block, 'FROM_HIGH', Order.NONE) || '0';
    const tl = g.valueToCode(block, 'TO_LOW', Order.NONE) || '0';
    const th = g.valueToCode(block, 'TO_HIGH', Order.NONE) || '0';
    return [
      `int((${val} - (${fl})) * ((${th}) - (${tl})) / ((${fh}) - (${fl})) + (${tl}))`,
      Order.ATOMIC,
    ];
  };

  gen.forBlock['mp_touch_read'] = (block, g) => {
    void g;
    const n = touchGpioFromBlock(gen, block, 'DPIN', 14);
    ensureTouch(gen, n);
    return [`_hw_touch_read(touch${n})`, Order.ATOMIC];
  };

  gen.forBlock['touch_module_read'] = (block, g) => {
    void g;
    const n = digitalGpio(block, 'DPIN', 4);
    const mode = safeFieldValue(block, 'MODE', 'NORMAL');
    if (!gen.definitions_[`%mp_pin_${n}`]) ensurePinIn(gen, n);
    const active = mode === 'INVERTED' ? 0 : 1;
    return [`(pin${n}.value() == ${active})`, Order.ATOMIC];
  };

  gen.forBlock['mp_touch_active_value'] = (block, g) => {
    void g;
    const n = touchGpioFromBlock(gen, block, 'DPIN', 14);
    const th = fieldNumberBlock(block, 'THRESH', 220, 1, 2000);
    ensureTouch(gen, n);
    return [`_hw_touch_active_value(touch${n}, ${th})`, Order.ATOMIC];
  };

  gen.forBlock['mp_max30102_setup'] = (block, g) => {
    void g;
    const sda = digitalGpio(block, 'SDA', 21);
    const scl = digitalGpio(block, 'SCL', 22);
    ensureMax30102Helper(gen, sda, scl);
    return `print("MAX30102 init: {}".format("OK" if max30102_init() else "FAIL"))\n`;
  };

  gen.forBlock['mp_max30102_print_raw'] = (block, g) => {
    void block;
    void g;
    if (!gen.definitions_['%mp_max30102_setup']) {
      ensureMax30102Helper(gen, 21, 22);
    }
    const ind = gen.INDENT;
    return (
      `# BPM needs several samples per second; burst read then one Serial line.\n` +
      `_pulse = (0, 0.0, 0)\n` +
      `for _mpx in range(50):\n` +
      `${ind}_pulse = max30102_pulse_reading()\n` +
      `${ind}time.sleep_ms(18)\n` +
      `print("IR={}, BPM={:.2f}, AVG BPM={}".format(int(_pulse[0]), float(_pulse[1]), int(_pulse[2])))\n`
    );
  };

  gen.forBlock['mp_i2c_scan'] = (block, g) => {
    void g;
    const sda = digitalGpio(block, 'SDA', 21);
    const scl = digitalGpio(block, 'SCL', 22);
    return (
      `_i2c_scan_bus = I2C(0, scl=Pin(${scl}), sda=Pin(${sda}), freq=400000)\n` +
      `_i2c_scan_addrs = _i2c_scan_bus.scan()\n` +
      `print("I2C scan SDA=${sda} SCL=${scl}: {}".format(_i2c_scan_addrs))\n`
    );
  };

  gen.forBlock['mp_neopixel_setup'] = (block, g) => {
    void g;
    const n = digitalGpio(block, 'DPIN', 18);
    const count = fieldNumberBlock(block, 'COUNT', 8, 1, 300);
    ensureNeoPixel(gen, n, count);
    return '';
  };

  gen.forBlock['mp_neopixel_fill'] = (block, g) => {
    void g;
    const r = fieldNumberBlock(block, 'R', 255, 0, 255);
    const gg = fieldNumberBlock(block, 'G', 0, 0, 255);
    const b = fieldNumberBlock(block, 'B', 0, 0, 255);
    if (!gen.definitions_['%mp_neopixel_setup']) {
      ensureNeoPixel(gen, 18, 8);
    }
    return `for _i in range(NP_COUNT):\n${gen.INDENT}np[_i] = (${r}, ${gg}, ${b})\nnp.write()\n`;
  };

  gen.forBlock['mp_display_i2c_setup'] = (block, g) => {
    void g;
    const w = fieldNumberBlock(block, 'W', 128, 8, 256);
    const h = fieldNumberBlock(block, 'H', 64, 8, 128);
    const scl = digitalGpio(block, 'SCL', 22);
    const sda = digitalGpio(block, 'SDA', 21);
    gen.definitions_[`%mp_oled`] =
      `display = None\n` +
      `display_mode = "none"\n` +
      `lcd_i2c = None\n` +
      `lcd_addr = 0\n` +
      `display_i2c_scan = []\n` +
      `try:\n` +
      `    import ssd1306\n` +
      `    i2c = I2C(0, scl=Pin(${scl}), sda=Pin(${sda}), freq=400000)\n` +
      `    display = ssd1306.SSD1306_I2C(${w}, ${h}, i2c)\n` +
      `    display_mode = "oled"\n` +
      `    try:\n` +
      `        display_i2c_scan = i2c.scan()\n` +
      `    except Exception:\n` +
      `        display_i2c_scan = []\n` +
      `except Exception:\n` +
      `    try:\n` +
      `        i2c = I2C(0, scl=Pin(${scl}), sda=Pin(${sda}), freq=100000)\n` +
      `        display_i2c_scan = i2c.scan()\n` +
      `        _cands = [a for a in display_i2c_scan if (0x20 <= int(a) <= 0x3F)]\n` +
      `        _pref = []\n` +
      `        if 0x27 in _cands:\n` +
      `            _pref.append(0x27)\n` +
      `        if 0x3F in _cands and 0x3F not in _pref:\n` +
      `            _pref.append(0x3F)\n` +
      `        for _a in _cands:\n` +
      `            if _a not in _pref:\n` +
      `                _pref.append(_a)\n` +
      `        for _a in _pref:\n` +
      `            try:\n` +
      `                i2c.writeto(_a, b'\\x00')\n` +
      `                lcd_i2c = i2c\n` +
      `                lcd_addr = _a\n` +
      `                display_mode = "lcd16x2"\n` +
      `                break\n` +
      `            except Exception:\n` +
      `                pass\n` +
      `    except Exception:\n` +
      `        display_mode = "none"\n`;
    if (!gen.definitions_['%mp_oled_print_mirror']) {
      gen.definitions_['%mp_oled_print_mirror'] = `
_orig_print = print
_hw_oled_y = 0
_hw_lcd_row = 0
_lcd_map = 0

def _lcd_pack(_nib, _rs):
    # map0: P0=RS, P2=E, P3=BL, P4..P7=D4..D7 (common)
    # map1: P2=RS, P0=E, P3=BL, P4..P7=D4..D7 (alt backpacks)
    if _lcd_map == 0:
        return (((_nib & 0x0F) << 4) | (0x01 if _rs else 0x00) | 0x08, 0x04)
    return (((_nib & 0x0F) << 4) | (0x04 if _rs else 0x00) | 0x08, 0x01)

def _lcd_write4(_nib, _rs):
    if lcd_i2c is None or not lcd_addr:
        return
    _d, _e = _lcd_pack(_nib, _rs)
    try:
        lcd_i2c.writeto(lcd_addr, bytes([_d | _e]))
        time.sleep_us(1)
        lcd_i2c.writeto(lcd_addr, bytes([_d & ~_e]))
    except Exception:
        pass

def _lcd_cmd(_c):
    _lcd_write4((_c >> 4) & 0x0F, 0)
    _lcd_write4(_c & 0x0F, 0)
    if _c in (0x01, 0x02):
        time.sleep_ms(2)
    else:
        time.sleep_us(50)

def _lcd_data(_d):
    _lcd_write4((_d >> 4) & 0x0F, 1)
    _lcd_write4(_d & 0x0F, 1)
    time.sleep_us(50)

def _lcd_init():
    global _lcd_map
    if lcd_i2c is None or not lcd_addr:
        return
    # Standard PCF8574 backpack wiring (map 0). Clear screen only — no debug text.
    _lcd_map = 0
    time.sleep_ms(50)
    _lcd_write4(0x03, 0)
    time.sleep_ms(5)
    _lcd_write4(0x03, 0)
    time.sleep_us(200)
    _lcd_write4(0x03, 0)
    _lcd_write4(0x02, 0)
    _lcd_cmd(0x28)
    _lcd_cmd(0x0C)
    _lcd_cmd(0x06)
    _lcd_cmd(0x01)
    time.sleep_ms(2)

def _lcd_set_cursor(_col, _row):
    _row = 0 if int(_row) <= 0 else 1
    _base = 0x00 if _row == 0 else 0x40
    _lcd_cmd(0x80 | (_base + max(0, min(15, int(_col)))))

def _lcd_write_line(_row, _msg):
    _lcd_set_cursor(0, _row)
    _t = str(_msg)
    if len(_t) < 16:
        _t = _t + (" " * (16 - len(_t)))
    else:
        _t = _t[:16]
    for _ch in _t:
        _lcd_data(ord(_ch))

def _hw_oled_line(_msg):
    global _hw_oled_y, _hw_lcd_row
    if display_mode == "oled":
        try:
            _t = str(_msg)
            if len(_t) > 21:
                _t = _t[:21]
            if _hw_oled_y == 0:
                display.fill(0)
            display.text(_t, 0, _hw_oled_y)
            display.show()
            _hw_oled_y = (_hw_oled_y + 10) % 60
        except Exception:
            pass
    elif display_mode == "lcd16x2":
        try:
            _lcd_write_line(_hw_lcd_row, _msg)
            _hw_lcd_row = 1 - _hw_lcd_row
        except Exception:
            pass

def _hw_display_text(_msg, _x=0, _y=0):
    if display_mode == "oled":
        try:
            display.text(str(_msg), int(_x), int(_y))
            display.show()
        except Exception:
            pass
    elif display_mode == "lcd16x2":
        _r = 1 if int(_y) >= 8 else 0
        _lcd_write_line(_r, _msg)

def print(*args, **kwargs):
    _orig_print(*args, **kwargs)
    if kwargs.get('end', '\\n') != '\\n':
        return
    _sep = kwargs.get('sep', ' ')
    try:
        _line = _sep.join([str(a) for a in args])
    except Exception:
        _line = ''
    _hw_oled_line(_line)
`;
    }
    return (
      `if display_mode == "lcd16x2":\n` +
      `${gen.INDENT}_lcd_init()\n` +
      `_orig_print("Display mode: {} addr: {} scan: {}".format(display_mode, (hex(lcd_addr) if lcd_addr else "-"), display_i2c_scan))\n`
    );
  };

  gen.forBlock['mp_display_text'] = (block, g) => {
    const t = g.valueToCode(block, 'TEXT', Order.NONE) || "''";
    const x = fieldNumberBlock(block, 'X', 0, 0, 127);
    const y = fieldNumberBlock(block, 'Y', 0, 0, 63);
    return `_hw_display_text(str(${t}), ${x}, ${y})\n`;
  };

  gen.forBlock['mp_pwm_write'] = (block, g) => {
    void g;
    const n = digitalGpio(block, 'DPIN', 22);
    const f = fieldNumberBlock(block, 'FREQ', 1000, 1, 40000);
    const d = fieldNumberBlock(block, 'DUTY', 512, 0, 1023);
    ensurePwm(gen, n, f);
    return `pwm${n}.duty(${d})\n`;
  };

  gen.forBlock['input_button_pressed'] = (block, g) => {
    void g;
    const n = digitalGpio(block, 'DPIN', 2);
    if (!gen.definitions_[`%mp_pin_${n}`]) ensurePinIn(gen, n);
    return [`(pin${n}.value() == 1)`, Order.ATOMIC];
  };

  gen.forBlock['input_potentiometer'] = (block, g) => {
    void g;
    const gpio = apinToGpio(block);
    ensureAdc(gen, gpio);
    return [`adc${gpio}.read()`, Order.ATOMIC];
  };

  gen.forBlock['input_ir_read'] = gen.forBlock['input_potentiometer'];
  gen.forBlock['input_pir_read'] = gen.forBlock['input_button_pressed'];

  gen.forBlock['output_led'] = gen.forBlock['board_digital_write'];

  gen.forBlock['output_buzzer_tone'] = (block, g) => {
    void g;
    const n = digitalGpio(block, 'DPIN', 9);
    const f = fieldNumberBlock(block, 'FREQ', 440, 20, 20000);
    const d = fieldNumberBlock(block, 'DUR', 200, 0, 60000);
    ensurePwm(gen, n, f);
    return `pwm${n}.duty(512)\ntime.sleep_ms(${d})\npwm${n}.duty(0)\n`;
  };

  gen.forBlock['output_buzzer_off'] = (block, g) => {
    void g;
    const n = digitalGpio(block, 'DPIN', 9);
    if (gen.definitions_[`%mp_pwm_${n}`]) {
      return `pwm${n}.duty(0)\n`;
    }
    ensurePwm(gen, n, 1000);
    return `pwm${n}.duty(0)\n`;
  };

  gen.forBlock['output_servo_write'] = (block, g) => {
    void g;
    const n = digitalGpio(block, 'DPIN', 9);
    const angleExpr = String(fieldNumberBlock(block, 'ANGLE', 90, 0, 180));
    ensureServoPin(gen, n);
    return `set_servo_angle(${n}, ${angleExpr})\nprint("Servo angle: {}".format(int(${angleExpr})))\n`;
  };

  gen.forBlock['output_motor_run'] = gen.forBlock['board_analog_write'];

  gen.forBlock['output_relay'] = (block, g) => {
    void g;
    const n = digitalGpio(block, 'DPIN', 7);
    const level = safeFieldValue(block, 'ON', '') || safeFieldValue(block, 'RELST', 'LOW');
    const v = level === 'HIGH' ? '1' : '0';
    if (!gen.definitions_[`%mp_pin_${n}`]) ensurePinOut(gen, n);
    return `pin${n}.value(${v})\n`;
  };

  gen.forBlock['sensor_ultrasonic_cm'] = (block, g) => {
    void g;
    const t = digitalGpio(block, 'TRIG', 12);
    const e = digitalGpio(block, 'ECHO', 11);
    ensureMpyUltrasonicHelper(gen);
    return [`_hw_ultra_cm(${t}, ${e})`, Order.ATOMIC];
  };

  gen.forBlock['sensor_dht_temp'] = (block, g) => {
    void g;
    const pin = digitalGpio(block, 'DPIN', 2);
    const typ = safeFieldValue(block, 'TYPE', 'DHT11');
    try {
      ensureMpyDht(gen, pin, typ);
      const id = dhtMpyId(pin, typ);
      return [`(_hw_dht_pair_${id}()[0])`, Order.ATOMIC];
    } catch {
      return ['float("nan")', Order.ATOMIC];
    }
  };

  gen.forBlock['sensor_dht_humidity'] = (block, g) => {
    void g;
    const pin = digitalGpio(block, 'DPIN', 2);
    const typ = safeFieldValue(block, 'TYPE', 'DHT11');
    try {
      ensureMpyDht(gen, pin, typ);
      const id = dhtMpyId(pin, typ);
      return [`(_hw_dht_pair_${id}()[1])`, Order.ATOMIC];
    } catch {
      return ['float("nan")', Order.ATOMIC];
    }
  };

  gen.forBlock['sensor_ldr'] = (block, g) => {
    void g;
    const gpio = apinToGpio(block);
    ensureAdc(gen, gpio);
    return [adcReadPercentExpr(gpio), Order.ATOMIC];
  };

  gen.forBlock['sensor_soil'] = gen.forBlock['sensor_ldr'];
  gen.forBlock['sensor_gas'] = gen.forBlock['sensor_ldr'];

  gen.forBlock['comm_serial_print'] = (block, g) => {
    const v = stripInlinePyComment(g.valueToCode(block, 'VAL', Order.NONE) || '0');
    return `print(${v}, end='')\n`;
  };

  gen.forBlock['comm_serial_println'] = (block, g) => {
    if (isDhtSerialBridgeMergeFollower(block)) {
      return '';
    }
    const merged = tryEmitMicropythonDhtSerialBridgePrintln(block, g);
    if (merged) return merged;
    const dhtFull = tryMicropythonDhtSingleFullLinePrintln(block, g);
    if (dhtFull) return dhtFull;
    const labeled = tryMicropythonLabeledSensorPrintln(block, g);
    if (labeled) return labeled;
    const v = stripInlinePyComment(g.valueToCode(block, 'VAL', Order.NONE) || '0');
    return `print(${v})\n`;
  };

  gen.forBlock['comm_bt_begin'] = () =>
    '# Bluetooth: use machine.UART or aioble on supported firmware — not generated here\n';

  gen.forBlock['comm_bt_send'] = (block, g) => {
    void g;
    const v = g.valueToCode(block, 'VAL', Order.NONE) || "''";
    return `# bt_send(${v})\n`;
  };

  gen.forBlock['comm_bt_available'] = () => ['False', Order.ATOMIC];
  gen.forBlock['comm_bt_read'] = () => ["''", Order.ATOMIC];

  gen.forBlock['controls_if'] = regenControlsIfPy;
  gen.forBlock['controls_ifelse'] = regenControlsIfPy;

  gen.forBlock['controls_repeat_ext'] = (block, g) => {
    const branch = ensureSuiteOrFallback(g.statementToCode(block, 'DO'), 'time.sleep_ms(1)');
    if (repeatExtHasInfiniteTimes(block)) {
      return `while True:\n${branch}${g.INDENT}time.sleep_ms(1)\n`;
    }
    let times = '1';
    try {
      if (block.getField('TIMES')) {
        times = String(Number(block.getFieldValue('TIMES')) || 0);
      } else {
        const vc = g.valueToCode(block, 'TIMES', Order.ADDITIVE);
        times = vc && String(vc).trim() ? String(vc).trim() : '1';
      }
    } catch {
      times = '1';
    }
    return `for _ in range(int(${times})):\n${branch}`;
  };

  gen.forBlock['controls_repeat'] = (block, g) => {
    let times = '0';
    try {
      times = String(Number(block.getFieldValue('TIMES')) || 0);
    } catch {
      times = '0';
    }
    const branch = ensureSuiteOrFallback(g.statementToCode(block, 'DO'));
    return `for _ in range(${times}):\n${branch}`;
  };

  gen.forBlock['controls_for'] = (block, g) => {
    try {
      const varName = g.getVariableName(safeFieldValue(block, 'VAR', '')) || 'i';
      const fromV = g.valueToCode(block, 'FROM', Order.NONE) || '0';
      const toV = g.valueToCode(block, 'TO', Order.NONE) || '0';
      const byV = g.valueToCode(block, 'BY', Order.NONE) || '1';
      const branch = ensureSuiteOrFallback(g.statementToCode(block, 'DO'));
      return `for ${varName} in range(int(${fromV}), int(${toV}) + 1, int(${byV})):\n${branch}`;
    } catch {
      return '# count loop error\n';
    }
  };

  gen.forBlock['controls_whileUntil'] = (block, g) => {
    if (isForeverWhileBlock(block)) {
      try {
        return g.statementToCode(block, 'DO') || '';
      } catch {
        return '# while True: (error)\n';
      }
    }
    const until = safeFieldValue(block, 'MODE', 'WHILE') === 'UNTIL';
    let cond = g.valueToCode(block, 'BOOL', Order.NONE) || 'False';
    if (until) cond = `(not (${cond}))`;
    const branch = ensureSuiteOrFallback(g.statementToCode(block, 'DO'), 'time.sleep_ms(1)');
    const sleepTick = `${g.INDENT}time.sleep_ms(1)\n`;
    return `while ${cond}:\n${branch}${sleepTick}`;
  };

  gen.forBlock['controls_flow_statements'] = (block) => {
    const flow = safeFieldValue(block, 'FLOW', '');
    if (flow === 'BREAK') return 'break\n';
    if (flow === 'CONTINUE') return 'continue\n';
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
    const op = safeFieldValue(block, 'OP', 'AND') === 'AND' ? 'and' : 'or';
    const ord = op === 'and' ? Order.LOGICAL_AND : Order.LOGICAL_OR;
    const a = g.valueToCode(block, 'A', ord) || 'False';
    const b = g.valueToCode(block, 'B', ord) || 'False';
    return [`(${a} ${op} ${b})`, ord];
  };

  gen.forBlock['logic_negate'] = (block, g) => {
    const v = g.valueToCode(block, 'BOOL', Order.LOGICAL_NOT) || 'False';
    return [`(not (${v}))`, Order.LOGICAL_NOT];
  };

  gen.forBlock['logic_boolean'] = (block) => {
    const v = safeFieldValue(block, 'BOOL', 'FALSE') === 'TRUE' ? 'True' : 'False';
    return [v, Order.ATOMIC];
  };

  gen.forBlock['math_number'] = (block) => {
    const n = Number(safeFieldValue(block, 'NUM', '0'));
    const num = Number.isFinite(n) ? n : 0;
    const ord = num < 0 ? Order.UNARY : Order.ATOMIC;
    return [String(num), ord];
  };

  gen.forBlock['math_constant'] = (block) => {
    const c = safeFieldValue(block, 'CONSTANT', 'PI');
    const literals = {
      PI: '3.14159265',
      E: '2.718281828',
      GOLDEN_RATIO: '1.61803398875',
      SQRT2: '1.41421356',
      SQRT1_2: '0.70710678',
      INFINITY: "float('inf')",
    };
    const v = literals[c];
    if (v !== undefined) return [v, Order.ATOMIC];
    return ['0', Order.ATOMIC];
  };

  gen.forBlock['math_arithmetic'] = (block, g) => {
    const op = safeFieldValue(block, 'OP', 'ADD');
    if (op === 'POWER') {
      const a = g.valueToCode(block, 'A', Order.NONE) || '0';
      const b = g.valueToCode(block, 'B', Order.NONE) || '0';
      ensureImp(gen, 'import math');
      return [`math.pow(${a}, ${b})`, Order.ATOMIC];
    }
    const table = {
      ADD: [' + ', Order.ADDITIVE],
      MINUS: [' - ', Order.ADDITIVE],
      MULTIPLY: [' * ', Order.MULTIPLY],
      DIVIDE: [' / ', Order.DIVIDE],
    };
    const row = table[op] ?? table.ADD;
    const a = g.valueToCode(block, 'A', row[1]) || '0';
    const b = g.valueToCode(block, 'B', row[1]) || '0';
    return [`(${a}${row[0]}${b})`, row[1]];
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
    return [`min(max(${v}, ${lo}), ${hi})`, Order.ATOMIC];
  };

  gen.forBlock['math_random_int'] = (block, g) => {
    ensureImp(gen, 'import random');
    const from = g.valueToCode(block, 'FROM', Order.NONE) || '0';
    const to = g.valueToCode(block, 'TO', Order.NONE) || '0';
    return [`random.randint(int(${from}), int(${to}))`, Order.ATOMIC];
  };

  gen.forBlock['math_change'] = (block, g) => {
    const d = g.valueToCode(block, 'DELTA', Order.ADDITIVE) || '0';
    try {
      const name = g.getVariableName(safeFieldValue(block, 'VAR', ''));
      return `${name} += ${d}\n`;
    } catch {
      return '# math_change error\n';
    }
  };

  gen.forBlock['math_round'] = (block, g) => {
    ensureImp(gen, 'import math');
    const op = safeFieldValue(block, 'OP', 'ROUND');
    const num = g.valueToCode(block, 'NUM', Order.NONE) || '0';
    if (op === 'ROUNDUP') return [`math.ceil(${num})`, Order.ATOMIC];
    if (op === 'ROUNDDOWN') return [`math.floor(${num})`, Order.ATOMIC];
    return [`round(${num})`, Order.ATOMIC];
  };

  gen.forBlock['math_single'] = (block, g) => {
    ensureImp(gen, 'import math');
    const op = safeFieldValue(block, 'OP', 'ABS');
    const num = g.valueToCode(block, 'NUM', Order.NONE) || '0';
    const map = {
      ABS: () => `abs(${num})`,
      NEG: () => `(-(${num}))`,
      ROOT: () => `math.sqrt(${num})`,
      SIN: () => `math.sin(math.radians(${num}))`,
      COS: () => `math.cos(math.radians(${num}))`,
      TAN: () => `math.tan(math.radians(${num}))`,
      LN: () => `math.log(${num})`,
      LOG10: () => `math.log10(${num})`,
      EXP: () => `math.exp(${num})`,
      POW10: () => `math.pow(10, ${num})`,
      ASIN: () => `math.degrees(math.asin(${num}))`,
      ACOS: () => `math.degrees(math.acos(${num}))`,
      ATAN: () => `math.degrees(math.atan(${num}))`,
    };
    const fn = map[op];
    if (!fn) return ['0', Order.ATOMIC];
    return [fn(), Order.ATOMIC];
  };

  gen.forBlock['text'] = (block) => {
    const raw = safeFieldValue(block, 'TEXT', '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return [`"${raw}"`, Order.ATOMIC];
  };

  gen.forBlock['text_join'] = regenTextJoinPy;

  gen.forBlock['text_length'] = (block, g) => {
    const v = g.valueToCode(block, 'VALUE', Order.NONE) || '""';
    return [`len(str(${v}))`, Order.ATOMIC];
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
      return `${name} = ${val}\n`;
    } catch {
      return '# variables_set error\n';
    }
  };

  gen.forBlock['variables_change'] = (block, g) => {
    try {
      const name = g.getVariableName(safeFieldValue(block, 'VAR', ''));
      const d = g.valueToCode(block, 'DELTA', Order.ADDITIVE) || '0';
      return `${name} += ${d}\n`;
    } catch {
      return '# variables_change error\n';
    }
  };

  gen.forBlock['procedures_defnoreturn'] = (block, g) => {
    try {
      const rawName = g.getProcedureName(safeFieldValue(block, 'NAME', 'my_function'));
      const inner = g.statementToCode(block, 'STACK');
      let params = '';
      try {
        const varIds = typeof block.getVars === 'function' ? block.getVars() : [];
        params = varIds.map((id) => g.getVariableName(id)).join(', ');
      } catch {
        params = '';
      }
      g.definitions_[`%proc_${rawName}`] = `def ${rawName}(${params}):\n${inner}\n`;
    } catch (e) {
      console.warn('[mpy] procedures_defnoreturn', e);
    }
    return null;
  };

  gen.forBlock['procedures_defreturn'] = (block, g) => {
    try {
      const rawName = g.getProcedureName(safeFieldValue(block, 'NAME', 'my_function'));
      const inner = g.statementToCode(block, 'STACK');
      const ret = block.getInput('RETURN')
        ? g.valueToCode(block, 'RETURN', Order.NONE) || '0'
        : '0';
      let params = '';
      try {
        const varIds = typeof block.getVars === 'function' ? block.getVars() : [];
        params = varIds.map((id) => g.getVariableName(id)).join(', ');
      } catch {
        params = '';
      }
      g.definitions_[`%proc_${rawName}`] =
        `def ${rawName}(${params}):\n${inner}${g.INDENT}return ${ret}\n\n`;
    } catch (e) {
      console.warn('[mpy] procedures_defreturn', e);
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
      return `${name}(${args.join(', ')})\n`;
    } catch {
      return '# procedures_callnoreturn error\n';
    }
  };

  /* mBlock-style labelled blocks (ESP32 MicroPython target) */
  const mblockPyStr = (s) =>
    String(s ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');

  gen.forBlock['mblock_wait_seconds'] = (block, g) => {
    void g;
    const sec = Number(safeFieldValue(block, 'SEC', '1'));
    const s = Number.isFinite(sec) ? Math.max(0, sec) : 1;
    ensureImp(gen, 'import time');
    return `time.sleep(${s})\n`;
  };
  gen.forBlock['mblock_stop'] = (block, g) => {
    void g;
    return `# stop ${safeFieldValue(block, 'WHICH', 'ALL')} (no sprite runtime)\n`;
  };
  gen.forBlock['mblock_show_variable'] = (block, g) => {
    void g;
    try {
      return `# show ${g.getVariableName(safeFieldValue(block, 'VAR', ''))}\n`;
    } catch {
      return '# show variable\n';
    }
  };
  gen.forBlock['mblock_hide_variable'] = (block, g) => {
    void g;
    try {
      return `# hide ${g.getVariableName(safeFieldValue(block, 'VAR', ''))}\n`;
    } catch {
      return '# hide variable\n';
    }
  };
  gen.forBlock['mblock_text_contains'] = (block, g) => {
    void g;
    const hay = mblockPyStr(safeFieldValue(block, 'HAY', ''));
    const nd = mblockPyStr(safeFieldValue(block, 'NEEDLE', ''));
    return [`("${nd}" in "${hay}")`, Order.ATOMIC];
  };
  gen.forBlock['mblock_letter_of'] = (block, g) => {
    void g;
    const n = Math.max(1, fieldNumberBlock(block, 'N', 1, 1, 999));
    const t = mblockPyStr(safeFieldValue(block, 'TEXT', ''));
    return [`("${t}"[${n} - 1:${n}])`, Order.ATOMIC];
  };
  gen.forBlock['mblock_map_inline'] = (block, g) => {
    void g;
    const v = fieldNumberBlock(block, 'V', 50, -32768, 32767);
    const fl = fieldNumberBlock(block, 'FL', 0, -32768, 32767);
    const fh = fieldNumberBlock(block, 'FH', 255, -32768, 32767);
    const tl = fieldNumberBlock(block, 'TL', 0, -32768, 32767);
    const th = fieldNumberBlock(block, 'TH', 1023, -32768, 32767);
    return [`int((${v} - (${fl})) * ((${th}) - (${tl})) / ((${fh}) - (${fl})) + (${tl}))`, Order.ATOMIC];
  };

  gen.forBlock['esp32_digital_read_boolean'] = (block, g) => {
    void g;
    const n = digitalGpio(block, 'DPIN', 2);
    if (!gen.definitions_[`%mp_pin_${n}`]) ensurePinIn(gen, n);
    return [`(pin${n}.value() == 1)`, Order.ATOMIC];
  };
  gen.forBlock['esp32_read_analog_pin'] = (block, g) => {
    void g;
    const gpio = adcGpioFromBlock(block, 'APIN_NUM', 32);
    ensureAdc(gen, gpio);
    return [`adc${gpio}.read()`, Order.ATOMIC];
  };
  gen.forBlock['esp32_set_digital_out'] = gen.forBlock['board_digital_write'];
  gen.forBlock['esp32_set_pwm_pin'] = gen.forBlock['board_analog_write'];
  gen.forBlock['esp32_touch_read_labeled'] = (block, g) => {
    void g;
    const raw = Number(safeFieldValue(block, 'TPAD', '15')) || 15;
    const gpio = touchGpioNumber(gen, raw);
    ensureTouch(gen, gpio);
    return [`_hw_touch_read(touch${gpio})`, Order.ATOMIC];
  };
  gen.forBlock['esp32_hall_value'] = (block, g) => {
    void g;
    ensureImp(gen, 'import esp32');
    return ['esp32.hall_sensor()', Order.ATOMIC];
  };
  gen.forBlock['esp32_bluetooth_mac'] = (block, g) => {
    void g;
    ensureImp(gen, 'import network');
    return [
      '":".join("%02x" % b for b in network.WLAN(network.STA_IF).config("mac"))',
      Order.ATOMIC,
    ];
  };

  gen.forBlock['mblock_motor_connect'] = (block, g) => {
    void g;
    const mid = digitalGpio(block, 'MID', 1);
    const d1 = digitalGpio(block, 'D1', 2);
    const d2 = digitalGpio(block, 'D2', 4);
    const pwm = digitalGpio(block, 'PWM', 5);
    void mid;
    ensurePinOut(gen, d1);
    ensurePinOut(gen, d2);
    ensurePwm(gen, pwm, 1000);
    return '';
  };
  gen.forBlock['mblock_motor_run'] = (block, g) => {
    void g;
    const mid = fieldNumberBlock(block, 'MID', 1, 1, 4);
    const cfg = lookupMblockMotorPinsMpy(block.workspace, String(mid));
    const d1 = cfg?.d1 ?? 2;
    const d2 = cfg?.d2 ?? 4;
    const pwm = cfg?.pwm ?? 5;
    ensurePinOut(gen, d1);
    ensurePinOut(gen, d2);
    ensurePwm(gen, pwm, 1000);
    const fwd = safeFieldValue(block, 'MDIR', 'FWD') === 'FWD';
    const duty = fieldNumberBlock(block, 'SPEED', 100, 0, 255);
    const pyDuty = Math.min(1023, duty * 4);
    const warn = cfg ? '' : `# motor ${mid}: no matching "connect motor" — default GPIO ${d1}/${d2}/PWM ${pwm}\n`;
    return [
      warn,
      `pin${d1}.value(${fwd ? 1 : 0})\n`,
      `pin${d2}.value(${fwd ? 0 : 1})\n`,
      `pwm${pwm}.duty(${pyDuty})\n`,
    ].join('');
  };
  gen.forBlock['mblock_motor_free'] = (block, g) => {
    void g;
    const kind = safeFieldValue(block, 'KIND', 'MOTOR');
    const mid = fieldNumberBlock(block, 'MID', 1, 1, 4);
    if (kind !== 'MOTOR') {
      return `# free ${kind} ${mid} — servo: use PWM duty 0 or dedicated driver\n`;
    }
    const cfg = lookupMblockMotorPinsMpy(block.workspace, String(mid));
    const d1 = cfg?.d1 ?? 2;
    const d2 = cfg?.d2 ?? 4;
    const pwm = cfg?.pwm ?? 5;
    ensurePinOut(gen, d1);
    ensurePinOut(gen, d2);
    ensurePwm(gen, pwm, 1000);
    const warn = cfg ? '' : `# motor ${mid}: no matching "connect motor" — default ${d1}/${d2}/${pwm}\n`;
    return [warn, `pin${d1}.value(0)\n`, `pin${d2}.value(0)\n`, `pwm${pwm}.duty(0)\n`].join('');
  };
  gen.forBlock['mblock_servo_set'] = gen.forBlock['output_servo_write'];
  gen.forBlock['motor_servo'] = gen.forBlock['output_servo_write'];
  gen.forBlock['actuator_servo'] = gen.forBlock['output_servo_write'];
  gen.forBlock['mblock_relay_set'] = gen.forBlock['output_relay'];

  gen.forBlock['sensor_ultrasonic_mblock'] = gen.forBlock['sensor_ultrasonic_cm'];
  gen.forBlock['sensor_digital_mblock'] = (block, g) => {
    void g;
    const n = digitalGpio(block, 'DPIN', 2);
    const st = safeFieldValue(block, 'DSTYPE', 'PIR');
    if (!gen.definitions_[`%mp_pin_${n}`]) ensurePinIn(gen, n);
    const isActiveLowIr = st === 'IR';
    return [`(pin${n}.value() == ${isActiveLowIr ? 0 : 1})`, Order.ATOMIC];
  };
  gen.forBlock['sensor_dht_mblock'] = (block, g) => {
    void g;
    const fld = safeFieldValue(block, 'DHTFIELD', 'TEMP');
    if (fld === 'HUM') return gen.forBlock['sensor_dht_humidity'](block, g);
    return gen.forBlock['sensor_dht_temp'](block, g);
  };
  gen.forBlock['sensor_bmp280_mblock'] = (_block, g) => {
    void g;
    if (!gen.definitions_['%bmp280_stub_note']) {
      gen.definitions_['%bmp280_stub_note'] =
        '# BMP280: I2C driver not generated here — block reads as NaN (add bmp280 library on device).\n';
    }
    return ["float('nan')", Order.ATOMIC];
  };
  gen.forBlock['sensor_analog_mblock'] = (block, g) => {
    void g;
    const gpio = adcGpioFromBlock(block, 'APIN', 32);
    const tag = safeFieldValue(block, 'ASTYPE', 'LDR');
    ensureAdc(gen, gpio);
    void tag;
    return [adcReadPercentExpr(gpio), Order.ATOMIC];
  };

  const mpIot = (msg) => `# IoT / app: ${msg}\n`;
  gen.forBlock['mblock_iot_create_file'] = (block, g) => {
    void g;
    return mpIot(`create ${safeFieldValue(block, 'FTYPE', 'FILE')} ${mblockPyStr(safeFieldValue(block, 'FNAME', ''))}`);
  };
  gen.forBlock['mblock_iot_log'] = (block, g) => {
    void g;
    return mpIot(`log ${mblockPyStr(safeFieldValue(block, 'COL', ''))} ${fieldNumberBlock(block, 'VAL', 0, -32768, 32767)}`);
  };
  gen.forBlock['mblock_iot_stop_logger'] = () => mpIot('stop logger');
  gen.forBlock['mblock_iot_notify'] = (block, g) => {
    void g;
    return mpIot(`notify ${mblockPyStr(safeFieldValue(block, 'TITLE', ''))}`);
  };
  gen.forBlock['mblock_iot_clear_notify'] = () => mpIot('clear notification');
  gen.forBlock['mblock_music_play'] = (block, g) => {
    void g;
    return mpIot(`play ${mblockPyStr(safeFieldValue(block, 'NOTE', ''))}`);
  };
  gen.forBlock['mblock_music_stop'] = () => mpIot('stop music');

  gen.forBlock['comm_bt_serial_baud'] = () => '# BT serial baud (module-dependent)\n';
  gen.forBlock['comm_serial_set_pins'] = (block, g) => {
    void g;
    return `# UART wiring: TX GPIO ${digitalGpio(block, 'TX', 19)}, RX GPIO ${digitalGpio(block, 'RX', 18)} (pass into UART(..., tx=, rx=) if needed)\n`;
  };
  gen.forBlock['comm_bt_configure'] = () =>
    '# Bluetooth classic: often via esp32 Bluetooth stack; BLE: consider aioble. Not emitted here.\n';
  gen.forBlock['comm_serial_baud_mblock'] = (block, g) => {
    void g;
    const port = safeFieldValue(block, 'SERPORT', '0');
    const baud = Number(safeFieldValue(block, 'BAUD', '115200')) || 115200;
    ensureImp(gen, 'from machine import UART');
    if (port === '0') {
      return `# UART0: usually USB REPL — avoid blocking reads here; use UART(1) or (2) for peripherals\n`;
    }
    gen.definitions_[`%mp_uart_${port}`] = `uart${port} = UART(${port}, ${baud})  # ESP32: add tx/rx= pins if required\n`;
    return '';
  };
  gen.forBlock['comm_serial_bytes_available'] = (block, g) => {
    void g;
    const port = safeFieldValue(block, 'SERPORT', '0');
    if (port === '0') {
      return ['False', Order.ATOMIC];
    }
    return [`(uart${port}.any() > 0)`, Order.ATOMIC];
  };
  gen.forBlock['comm_bt_data_available'] = gen.forBlock['comm_bt_available'];
  gen.forBlock['comm_bt_read_bytes'] = gen.forBlock['comm_bt_read'];
  gen.forBlock['comm_bt_send_text'] = (block, g) => {
    void g;
    const line = mblockPyStr(safeFieldValue(block, 'LINE', ''));
    return `# Bluetooth TX not generated — use socket/uart after pairing, or esp32 BLE libs. Payload: ${line}\n`;
  };
  gen.forBlock['comm_serial_read_bytes'] = (block, g) => {
    void g;
    const port = safeFieldValue(block, 'SERPORT', '0');
    if (port === '0') return ['0', Order.ATOMIC];
    return [`(uart${port}.read(1)[0] if uart${port}.any() else 0)`, Order.ATOMIC];
  };
  gen.forBlock['comm_serial_get_number'] = (block, g) => {
    void g;
    const port = safeFieldValue(block, 'SERPORT', '0');
    if (port === '0') return ['0', Order.ATOMIC];
    return [
      `(int(uart${port}.readline()) if uart${port}.any() else 0)  # expects ASCII digits + newline; may block`,
      Order.ATOMIC,
    ];
  };
  gen.forBlock['comm_serial_read_string'] = (block, g) => {
    void g;
    const port = safeFieldValue(block, 'SERPORT', '0');
    if (port === '0') return ["''", Order.ATOMIC];
    return [`(uart${port}.read().decode() if uart${port}.any() else '')`, Order.ATOMIC];
  };
  gen.forBlock['comm_serial_write_text'] = (block, g) => {
    void g;
    const raw = safeFieldValue(block, 'LINE', '');
    const port = safeFieldValue(block, 'SERPORT', '0');
    if (port === '0') return `print("${mblockPyStr(raw)}")\n`;
    const lit = JSON.stringify(`${raw}\n`);
    return `uart${port}.write(${lit}.encode())\n`;
  };

  const mpDabble = (msg) => `# Dabble phone bridge: not available in generated MicroPython — ${msg}\n`;
  gen.forBlock['dabble_enable_servo'] = () => mpDabble('on ESP32 use DabbleESP32 (Controls.runServo1/2)');
  gen.forBlock['dabble_enable_motor'] = (block, g) =>
    `${mpDabble('Dabble Motor module maps to Controls.runMotor* on ESP32 with DabbleESP32')}${gen.forBlock['mblock_motor_connect'](block, g)}`;
  gen.forBlock['dabble_tactile_pressed'] = () => ['False', Order.ATOMIC];
  gen.forBlock['dabble_slide_switch'] = () => ['False', Order.ATOMIC];
  gen.forBlock['dabble_pot_value'] = () => ['0', Order.ATOMIC];
  gen.forBlock['dabble_phone_accel'] = () => ['0', Order.ATOMIC];
  gen.forBlock['dabble_camera_setup'] = () => mpDabble('Camera.setParameters / flash / quality / zoom');
  gen.forBlock['dabble_camera_rotate'] = () => mpDabble('Camera.flipTo');
  gen.forBlock['dabble_camera_capture'] = () => mpDabble('Camera.captureImage');
  gen.forBlock['dabble_color_grid'] = () => mpDabble('ColorDetector.sendSettings');
  gen.forBlock['dabble_color_cell'] = () => ['0', Order.ATOMIC];
  gen.forBlock['dabble_bt_name'] = () => mpDabble('Dabble.begin(name)');
  gen.forBlock['dabble_refresh'] = () => mpDabble('Dabble.processInput');
  gen.forBlock['dabble_led_control'] = () => mpDabble('LedControl module');
  gen.forBlock['dabble_terminal_has_data'] = () => ['False', Order.ATOMIC];
  gen.forBlock['dabble_terminal_number'] = () => ['0.0', Order.ATOMIC];
  gen.forBlock['dabble_terminal_send'] = (block, g) => {
    void g;
    return `print("${mblockPyStr(safeFieldValue(block, 'LINE', ''))}")  # USB REPL only — not Dabble Terminal\n`;
  };
  gen.forBlock['dabble_gamepad_pressed'] = () => ['False', Order.ATOMIC];
  gen.forBlock['dabble_gamepad_value'] = () => ['0', Order.ATOMIC];
  gen.forBlock['dabble_pin_monitor'] = () => mpDabble('PinMonitor.sendDigitalData / sendAnalogData');
}

function createMicroPythonGenerator() {
  const gen = new CodeGenerator('MicroPython');
  gen.INDENT = '    ';
  gen.addReservedWords('and,or,not,True,False,pass,def,if,else,elif,while,for,in,import,from,as,return,print,global,nonlocal');
  installMicroPythonScrub(gen);
  registerMicroPythonHardware(gen);
  installSafeValueAndStatementWrappers(gen);
  installSafeBlockToCodeWrapper(gen);
  installSafeWorkspaceToCode(gen);
  return gen;
}

function sortDefinitionsBody(definitions) {
  try {
    return Object.keys(definitions)
      .filter((k) => k.startsWith('%') && typeof definitions[k] === 'string')
      .sort()
      .map((k) => definitions[k])
      .join('');
  } catch {
    return '';
  }
}

function fallbackMicroPython(note) {
  return `""" ESP32 MicroPython — hardware block IDE """\n# ${note}\nfrom machine import Pin\nimport time\n\nwhile True:\n    time.sleep_ms(400)\n`;
}

/**
 * @param {import('blockly/core/workspace').Workspace} workspace
 */
export function buildMicroPythonSketch(workspace) {
  if (!workspace || typeof workspace.getAllBlocks !== 'function') {
    return fallbackMicroPython('Workspace not ready.');
  }

  let gen;
  try {
    gen = createMicroPythonGenerator();
    gen.init(workspace);
  } catch (e) {
    console.warn('[mpy] init', e);
    return fallbackMicroPython(String(e?.message || e));
  }

  for (const block of workspace.getTopBlocks(true)) {
    const t = block?.type;
    if (t === 'procedures_defnoreturn' || t === 'procedures_defreturn') {
      try {
        gen.blockToCode(block);
      } catch {
        /* */
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
    console.warn('[mpy] partition', e);
    loopRaw = `# partition error: ${String(e?.message || e)}\n`;
  }

  const IND = gen.INDENT;
  const staticHead =
    '""" ESP32 MicroPython — generated from blocks (USB REPL / flashed main.py) """\n' +
    'from machine import Pin, PWM, ADC, TouchPad, I2C, time_pulse_us\n' +
    'import machine\n' +
    'import time\n';

  const dyn = sortDefinitionsBody(gen.definitions_);
  const decl = (() => {
    try {
      const vars = Variables.allUsedVarModels(workspace) || [];
      return vars
        .map((v) => {
          try {
            return `${gen.getVariableName(v.getId())} = 0`;
          } catch {
            return '# variable decl skipped';
          }
        })
        .join('\n');
    } catch {
      return '';
    }
  })();

  const varsSection = decl ? `${IND}# — workspace variables —\n${indentPy(decl, IND)}\n` : '';
  const servoSetupRaw = (() => {
    try {
      const entries = Object.entries(gen.__mpServoSetupInit || {});
      if (!entries.length) return '';
      return entries
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([, code]) => String(code || ''))
        .join('');
    } catch {
      return '';
    }
  })();
  const servoSetupSection = servoSetupRaw
    ? `${IND}# — servo pwm init —\n${indentPy(servoSetupRaw, IND)}\n`
    : '';

  const setupWhen = `${IND}# — when board starts —\n`;
  const setupFromHat = String(setupRaw || '').trim()
    ? `${setupWhen}${indentPy(setupRaw, IND)}\n`
    : `${setupWhen}`;
  const setupInner = `${varsSection}${servoSetupSection}${setupFromHat}`;
  const setupSection = mpyBlockHasExecutableLine(setupInner)
    ? setupInner
    : `${setupInner}${IND}pass\n`;

  const loopWhen = `${IND}# — main loop —\n`;
  let loopBody;
  if (!String(loopRaw || '').trim()) {
    loopBody = `${loopWhen}${IND}time.sleep_ms(10)\n`;
  } else {
    const loopCore = `${loopWhen}${indentPy(loopRaw, IND)}\n`;
    const hasSleep = /time\.sleep(?:_ms)?\s*\(/m.test(String(loopRaw || ''));
    const loopYield = hasSleep ? '' : `${IND}time.sleep_ms(400)\n`;
    loopBody = mpyBlockHasExecutableLine(loopCore)
      ? `${loopCore}${loopYield}`
      : `${loopCore}${IND}time.sleep_ms(10)\n`;
  }

  try {
    const out = `${staticHead}\n${dyn}\n\ndef setup():\n${setupSection}\n\ndef loop():\n${loopBody}\n\nsetup()\nwhile True:\n${IND}loop()\n`;
    return out;
  } catch (e) {
    console.warn('[mpy] assemble', e);
    return fallbackMicroPython(String(e?.message || e));
  }
}
