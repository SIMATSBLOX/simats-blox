import { getReadingsPostUrl } from './apiConfig.js';
import { getSensorPresetByType } from './sensorAddPresets.js';

const SUPPORTED_SENSOR_TYPES = new Set([
  'dht11',
  'lm35',
  'mq2',
  'pir',
  'ldr',
  'ultrasonic',
  'bmp280',
  'soil_moisture',
  'rain_sensor',
  'ir_sensor',
  'servo',
  'custom',
]);

/** True when we can emit complete firmware (real device key only — no placeholders for learners). */
export function hasUsableDeviceKeyForSamples(apiKey) {
  return Boolean(String(apiKey ?? '').trim());
}

/** @param {string} s */
function pyEscapeDoubleQuoted(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n');
}

/**
 * @param {string} sensorType
 */
export function supportsDeviceHardwareSample(sensorType) {
  return SUPPORTED_SENSOR_TYPES.has(sensorType);
}

/**
 * @param {string} sensorType
 * @param {{ readingsUrl?: string; deviceId: string; apiKey: string }} ctx
 * @returns {{ label: string; micropython: string } | null}
 */
export function getEsp32Samples(sensorType, ctx) {
  if (!supportsDeviceHardwareSample(sensorType)) return null;
  if (!hasUsableDeviceKeyForSamples(ctx.apiKey)) return null;
  const base = {
    readingsUrl: ctx.readingsUrl || getReadingsPostUrl(),
    deviceId: ctx.deviceId,
    apiKey: String(ctx.apiKey).trim(),
  };
  const preset = getSensorPresetByType(sensorType);
  const label =
    sensorType === 'custom'
      ? 'Custom sensor — your field names in data'
      : preset
        ? `${preset.title} — ${preset.subtitle}`
        : sensorType;
  switch (sensorType) {
    case 'dht11':
      return {
        label,
        micropython: buildEsp32Dht11MicroPythonScript(base),
      };
    case 'mq2':
      return {
        label,
        micropython: buildEsp32Mq2MicroPython(base),
      };
    case 'pir':
      return {
        label,
        micropython: buildEsp32PirMicroPython(base),
      };
    case 'ldr':
      return {
        label,
        micropython: buildEsp32LdrMicroPython(base),
      };
    case 'soil_moisture':
      return {
        label,
        micropython: buildEsp32SoilMoistureMicroPython(base),
      };
    case 'rain_sensor':
      return {
        label,
        micropython: buildEsp32RainSensorMicroPython(base),
      };
    case 'bmp280':
      return {
        label,
        micropython: buildEsp32Bmp280MicroPython(base),
      };
    case 'ultrasonic':
      return {
        label,
        micropython: buildEsp32UltrasonicMicroPython(base),
      };
    case 'ir_sensor':
      return {
        label,
        micropython: buildEsp32IrMicroPython(base),
      };
    case 'lm35':
      return {
        label,
        micropython: buildEsp32Lm35MicroPython(base),
      };
    case 'servo':
      return {
        label,
        micropython: buildEsp32ServoMicroPython(base),
      };
    case 'custom':
      return {
        label,
        micropython: buildEsp32CustomMicroPython(base),
      };
    default:
      return null;
  }
}

/**
 * @param {{
 *   readingsUrl?: string;
 *   deviceId: string;
 *   apiKey: string;
 * }} p
 */
function buildEsp32Dht11MicroPythonScript(p) {
  const readUrl = p.readingsUrl || getReadingsPostUrl();
  const deviceId = String(p.deviceId ?? '').trim() || 'your_device_id';
  const key = String(p.apiKey ?? '').trim();
  const urlPy = pyEscapeDoubleQuoted(readUrl);
  const idPy = pyEscapeDoubleQuoted(deviceId);
  const keyPy = pyEscapeDoubleQuoted(key);

  return `# SIMATS BLOX — ESP32 + DHT11 → POST /api/readings (MicroPython)
# Install urequests: mpremote mip install urequests
# Or: import mip; mip.install("urequests")
#
# Wiring: DHT11 DATA -> GPIO 4, VCC -> 3.3V, GND -> GND

import network
import time
import json
import machine
import dht

try:
    import urequests
except ImportError:
    print("Install urequests: import mip; mip.install('urequests')")
    raise

READINGS_URL = "${urlPy}"
DEVICE_ID = "${idPy}"
DEVICE_KEY = "${keyPy}"

WIFI_SSID = "YOUR_WIFI_SSID"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"

DHT_PIN = 4
INTERVAL_S = 15


def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(WIFI_SSID, WIFI_PASSWORD)
    while not wlan.isconnected():
        time.sleep_ms(400)
    print("WiFi OK", wlan.ifconfig())


def post_reading(temp, hum):
    payload = {
        "deviceId": DEVICE_ID,
        "sensorType": "dht11",
        "data": {"temperature": float(temp), "humidity": float(hum)},
    }
    body = json.dumps(payload)
    r = urequests.post(
        READINGS_URL,
        data=body,
        headers={"Content-Type": "application/json", "x-device-key": DEVICE_KEY},
    )
    print("HTTP", r.status_code)
    r.close()


def main():
    connect_wifi()
    sensor = dht.DHT11(machine.Pin(DHT_PIN))
    while True:
        try:
            sensor.measure()
            post_reading(sensor.temperature(), sensor.humidity())
        except OSError as e:
            print("sensor error", e)
        time.sleep(INTERVAL_S)


main()
`;
}

function buildEsp32SoilMoistureMicroPython(p) {
  const readUrl = p.readingsUrl || getReadingsPostUrl();
  const deviceId = String(p.deviceId ?? '').trim() || 'your_device_id';
  const key = String(p.apiKey ?? '').trim();
  return `# SIMATS BLOX — soil moisture (ADC) → POST
try:
    import urequests
except ImportError:
    import mip; mip.install("urequests"); import urequests
import network, time, json
from machine import ADC, Pin

READINGS_URL = "${pyEscapeDoubleQuoted(readUrl)}"
DEVICE_ID = "${pyEscapeDoubleQuoted(deviceId)}"
DEVICE_KEY = "${pyEscapeDoubleQuoted(key)}"
ADC_PIN = 34
WIFI_SSID = "YOUR_WIFI_SSID"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"

def wifi():
    w = network.WLAN(network.STA_IF); w.active(True); w.connect(WIFI_SSID, WIFI_PASSWORD)
    while not w.isconnected(): time.sleep_ms(400)
    print("WiFi OK")

def send(val):
    body = json.dumps({"deviceId": DEVICE_ID, "sensorType": "soil_moisture", "data": {"soilMoisture": int(val)}})
    r = urequests.post(READINGS_URL, data=body, headers={"Content-Type": "application/json", "x-device-key": DEVICE_KEY})
    print("HTTP", r.status_code); r.close()

wifi()
adc = ADC(Pin(ADC_PIN))
adc.atten(ADC.ATTN_11DB)
while True:
    send(adc.read())
    time.sleep(5)
`;
}

function buildEsp32UltrasonicMicroPython(p) {
  const readUrl = p.readingsUrl || getReadingsPostUrl();
  const deviceId = String(p.deviceId ?? '').trim() || 'your_device_id';
  const key = String(p.apiKey ?? '').trim();
  return `# SIMATS BLOX — ultrasonic → POST (Trig/Echo)
try:
    import urequests
except ImportError:
    import mip; mip.install("urequests"); import urequests
import machine
import network, time, json
from machine import Pin

READINGS_URL = "${pyEscapeDoubleQuoted(readUrl)}"
DEVICE_ID = "${pyEscapeDoubleQuoted(deviceId)}"
DEVICE_KEY = "${pyEscapeDoubleQuoted(key)}"
TRIG, ECHO = Pin(5, Pin.OUT), Pin(18, Pin.IN)
WIFI_SSID = "YOUR_WIFI_SSID"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"

def dist_cm():
    TRIG.off(); time.sleep_us(2); TRIG.on(); time.sleep_us(10); TRIG.off()
    t = machine.time_pulse_us(ECHO, 1, 30000)
    if t < 0: return 0.0
    return (t / 2.0) / 29.1

def wifi():
    w = network.WLAN(network.STA_IF); w.active(True); w.connect(WIFI_SSID, WIFI_PASSWORD)
    while not w.isconnected(): time.sleep_ms(400)

wifi()
while True:
    body = json.dumps({"deviceId": DEVICE_ID, "sensorType": "ultrasonic", "data": {"distanceCm": dist_cm()}})
    r = urequests.post(READINGS_URL, data=body, headers={"Content-Type": "application/json", "x-device-key": DEVICE_KEY})
    r.close()
    time.sleep(2)
`;
}

function buildEsp32IrMicroPython(p) {
  const readUrl = p.readingsUrl || getReadingsPostUrl();
  const deviceId = String(p.deviceId ?? '').trim() || 'your_device_id';
  const key = String(p.apiKey ?? '').trim();
  return `# SIMATS BLOX — IR → POST
try:
    import urequests
except ImportError:
    import mip; mip.install("urequests"); import urequests
import network, time, json
from machine import Pin

READINGS_URL = "${pyEscapeDoubleQuoted(readUrl)}"
DEVICE_ID = "${pyEscapeDoubleQuoted(deviceId)}"
DEVICE_KEY = "${pyEscapeDoubleQuoted(key)}"
IR = Pin(14, Pin.IN, Pin.PULL_UP)
WIFI_SSID = "YOUR_WIFI_SSID"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"

def wifi():
    w = network.WLAN(network.STA_IF); w.active(True); w.connect(WIFI_SSID, WIFI_PASSWORD)
    while not w.isconnected(): time.sleep_ms(400)

wifi()
while True:
    det = IR.value() == 0
    body = json.dumps({"deviceId": DEVICE_ID, "sensorType": "ir_sensor", "data": {"irDetected": bool(det)}})
    r = urequests.post(READINGS_URL, data=body, headers={"Content-Type": "application/json", "x-device-key": DEVICE_KEY})
    r.close()
    time.sleep(1.5)
`;
}

function buildEsp32Lm35MicroPython(p) {
  const readUrl = p.readingsUrl || getReadingsPostUrl();
  const deviceId = String(p.deviceId ?? '').trim() || 'your_device_id';
  const key = String(p.apiKey ?? '').trim();
  return `# SIMATS BLOX — LM35 ADC → POST
try:
    import urequests
except ImportError:
    import mip; mip.install("urequests"); import urequests
import network, time, json
from machine import ADC, Pin

READINGS_URL = "${pyEscapeDoubleQuoted(readUrl)}"
DEVICE_ID = "${pyEscapeDoubleQuoted(deviceId)}"
DEVICE_KEY = "${pyEscapeDoubleQuoted(key)}"
WIFI_SSID = "YOUR_WIFI_SSID"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"

def wifi():
    w = network.WLAN(network.STA_IF); w.active(True); w.connect(WIFI_SSID, WIFI_PASSWORD)
    while not w.isconnected(): time.sleep_ms(400)

def temp_c(adc):
    raw = adc.read()
    mv = (raw / 4095.0) * 3300.0
    return mv / 10.0

wifi()
adc = ADC(Pin(35))
adc.atten(ADC.ATTN_11DB)
while True:
    body = json.dumps({"deviceId": DEVICE_ID, "sensorType": "lm35", "data": {"temperature": temp_c(adc)}})
    r = urequests.post(READINGS_URL, data=body, headers={"Content-Type": "application/json", "x-device-key": DEVICE_KEY})
    r.close()
    time.sleep(3)
`;
}

function buildEsp32Mq2MicroPython(p) {
  const readUrl = p.readingsUrl || getReadingsPostUrl();
  const deviceId = String(p.deviceId ?? '').trim() || 'your_device_id';
  const key = String(p.apiKey ?? '').trim();
  return `# SIMATS BLOX — MQ-2 → POST (raw ADC)
try:
    import urequests
except ImportError:
    import mip; mip.install("urequests"); import urequests
import network, time, json
from machine import ADC, Pin

READINGS_URL = "${pyEscapeDoubleQuoted(readUrl)}"
DEVICE_ID = "${pyEscapeDoubleQuoted(deviceId)}"
DEVICE_KEY = "${pyEscapeDoubleQuoted(key)}"
WIFI_SSID = "YOUR_WIFI_SSID"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"

def wifi():
    w = network.WLAN(network.STA_IF); w.active(True); w.connect(WIFI_SSID, WIFI_PASSWORD)
    while not w.isconnected(): time.sleep_ms(400)

wifi()
adc = ADC(Pin(32))
adc.atten(ADC.ATTN_11DB)
while True:
    body = json.dumps({"deviceId": DEVICE_ID, "sensorType": "mq2", "data": {"gasLevel": adc.read()}})
    r = urequests.post(READINGS_URL, data=body, headers={"Content-Type": "application/json", "x-device-key": DEVICE_KEY})
    r.close()
    time.sleep(2)
`;
}

function buildEsp32PirMicroPython(p) {
  const readUrl = p.readingsUrl || getReadingsPostUrl();
  const deviceId = String(p.deviceId ?? '').trim() || 'your_device_id';
  const key = String(p.apiKey ?? '').trim();
  return `# SIMATS BLOX — PIR → POST
try:
    import urequests
except ImportError:
    import mip; mip.install("urequests"); import urequests
import network, time, json
from machine import Pin

READINGS_URL = "${pyEscapeDoubleQuoted(readUrl)}"
DEVICE_ID = "${pyEscapeDoubleQuoted(deviceId)}"
DEVICE_KEY = "${pyEscapeDoubleQuoted(key)}"
PIR = Pin(27, Pin.IN)
WIFI_SSID = "YOUR_WIFI_SSID"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"

def wifi():
    w = network.WLAN(network.STA_IF); w.active(True); w.connect(WIFI_SSID, WIFI_PASSWORD)
    while not w.isconnected(): time.sleep_ms(400)

wifi()
while True:
    motion = PIR.value() == 1
    body = json.dumps({"deviceId": DEVICE_ID, "sensorType": "pir", "data": {"motionDetected": bool(motion)}})
    r = urequests.post(READINGS_URL, data=body, headers={"Content-Type": "application/json", "x-device-key": DEVICE_KEY})
    r.close()
    time.sleep(0.8)
`;
}

function buildEsp32LdrMicroPython(p) {
  const readUrl = p.readingsUrl || getReadingsPostUrl();
  const deviceId = String(p.deviceId ?? '').trim() || 'your_device_id';
  const key = String(p.apiKey ?? '').trim();
  return `# SIMATS BLOX — LDR → POST
try:
    import urequests
except ImportError:
    import mip; mip.install("urequests"); import urequests
import network, time, json
from machine import ADC, Pin

READINGS_URL = "${pyEscapeDoubleQuoted(readUrl)}"
DEVICE_ID = "${pyEscapeDoubleQuoted(deviceId)}"
DEVICE_KEY = "${pyEscapeDoubleQuoted(key)}"
WIFI_SSID = "YOUR_WIFI_SSID"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"

def wifi():
    w = network.WLAN(network.STA_IF); w.active(True); w.connect(WIFI_SSID, WIFI_PASSWORD)
    while not w.isconnected(): time.sleep_ms(400)

wifi()
adc = ADC(Pin(33))
adc.atten(ADC.ATTN_11DB)
while True:
    body = json.dumps({"deviceId": DEVICE_ID, "sensorType": "ldr", "data": {"lightLevel": adc.read()}})
    r = urequests.post(READINGS_URL, data=body, headers={"Content-Type": "application/json", "x-device-key": DEVICE_KEY})
    r.close()
    time.sleep(2)
`;
}

function buildEsp32RainSensorMicroPython(p) {
  const readUrl = p.readingsUrl || getReadingsPostUrl();
  const deviceId = String(p.deviceId ?? '').trim() || 'your_device_id';
  const key = String(p.apiKey ?? '').trim();
  return `# SIMATS BLOX — Rain sensor → POST
try:
    import urequests
except ImportError:
    import mip; mip.install("urequests"); import urequests
import network, time, json
from machine import ADC, Pin

READINGS_URL = "${pyEscapeDoubleQuoted(readUrl)}"
DEVICE_ID = "${pyEscapeDoubleQuoted(deviceId)}"
DEVICE_KEY = "${pyEscapeDoubleQuoted(key)}"
WIFI_SSID = "YOUR_WIFI_SSID"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"

def wifi():
    w = network.WLAN(network.STA_IF); w.active(True); w.connect(WIFI_SSID, WIFI_PASSWORD)
    while not w.isconnected(): time.sleep_ms(400)

wifi()
adc = ADC(Pin(39))
adc.atten(ADC.ATTN_11DB)
while True:
    body = json.dumps({"deviceId": DEVICE_ID, "sensorType": "rain_sensor", "data": {"rainLevel": adc.read()}})
    r = urequests.post(READINGS_URL, data=body, headers={"Content-Type": "application/json", "x-device-key": DEVICE_KEY})
    r.close()
    time.sleep(2)
`;
}

function buildEsp32Bmp280MicroPython(p) {
  const readUrl = p.readingsUrl || getReadingsPostUrl();
  const deviceId = String(p.deviceId ?? '').trim() || 'your_device_id';
  const key = String(p.apiKey ?? '').trim();
  return `# SIMATS BLOX — BMP280 → POST (install bmp280 on your firmware build)
try:
    import urequests
except ImportError:
    import mip; mip.install("urequests"); import urequests
import network, time, json
from machine import Pin, I2C

READINGS_URL = "${pyEscapeDoubleQuoted(readUrl)}"
DEVICE_ID = "${pyEscapeDoubleQuoted(deviceId)}"
DEVICE_KEY = "${pyEscapeDoubleQuoted(key)}"
WIFI_SSID = "YOUR_WIFI_SSID"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"

def wifi():
    w = network.WLAN(network.STA_IF); w.active(True); w.connect(WIFI_SSID, WIFI_PASSWORD)
    while not w.isconnected(): time.sleep_ms(400)

# Example: from bmp280 import BMP280
# i2c = I2C(0, scl=Pin(22), sda=Pin(21))
# bmp = BMP280(i2c)

wifi()
while True:
    # Replace with real reads, e.g. bmp.temperature, bmp.pressure/100
    t, p_hpa = 0.0, 1013.25
    body = json.dumps({"deviceId": DEVICE_ID, "sensorType": "bmp280", "data": {"temperature": t, "pressure": p_hpa}})
    r = urequests.post(READINGS_URL, data=body, headers={"Content-Type": "application/json", "x-device-key": DEVICE_KEY})
    r.close()
    time.sleep(3)
`;
}

/**
 * @param {{
 *   readingsUrl?: string;
 *   deviceId: string;
 *   apiKey: string;
 * }} p
 */
function buildEsp32CustomMicroPython(p) {
  const readUrl = p.readingsUrl || getReadingsPostUrl();
  const deviceId = String(p.deviceId ?? '').trim() || 'your_device_id';
  const key = String(p.apiKey ?? '').trim();
  return `# SIMATS BLOX — ESP32 custom sensor → POST (sensorType: custom)
try:
    import urequests
except ImportError:
    import mip; mip.install("urequests"); import urequests
import network, time, json

READINGS_URL = "${pyEscapeDoubleQuoted(readUrl)}"
DEVICE_ID = "${pyEscapeDoubleQuoted(deviceId)}"
DEVICE_KEY = "${pyEscapeDoubleQuoted(key)}"
WIFI_SSID = "YOUR_WIFI_SSID"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"

def wifi():
    w = network.WLAN(network.STA_IF); w.active(True); w.connect(WIFI_SSID, WIFI_PASSWORD)
    while not w.isconnected(): time.sleep_ms(400)

wifi()
while True:
    payload = {"deviceId": DEVICE_ID, "sensorType": "custom", "data": {"reading": 42}}
    body = json.dumps(payload)
    r = urequests.post(READINGS_URL, data=body, headers={"Content-Type": "application/json", "x-device-key": DEVICE_KEY})
    r.close()
    time.sleep(3)
`;
}

/**
 * @param {{
 *   readingsUrl?: string;
 *   deviceId: string;
 *   apiKey: string;
 * }} p
 */
function buildEsp32ServoMicroPython(p) {
  const readUrl = p.readingsUrl || getReadingsPostUrl();
  const deviceId = String(p.deviceId ?? '').trim() || 'your_device_id';
  const key = String(p.apiKey ?? '').trim();
  return `# SIMATS BLOX — servo → POST /api/readings (MicroPython)
# Wire the servo signal pin; drive PWM as needed. This sample only posts angle.
try:
    import urequests
except ImportError:
    import mip; mip.install("urequests"); import urequests
import network, time, json

READINGS_URL = "${pyEscapeDoubleQuoted(readUrl)}"
DEVICE_ID = "${pyEscapeDoubleQuoted(deviceId)}"
DEVICE_KEY = "${pyEscapeDoubleQuoted(key)}"
WIFI_SSID = "YOUR_WIFI_SSID"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"

def wifi():
    w = network.WLAN(network.STA_IF)
    w.active(True)
    w.connect(WIFI_SSID, WIFI_PASSWORD)
    while not w.isconnected():
        time.sleep_ms(400)


wifi()
while True:
    angle = 90
    body = json.dumps({"deviceId": DEVICE_ID, "sensorType": "servo", "data": {"angle": angle}})
    r = urequests.post(
        READINGS_URL,
        data=body,
        headers={"Content-Type": "application/json", "x-device-key": DEVICE_KEY},
    )
    print("HTTP", r.status_code)
    r.close()
    time.sleep(5)
`;
}
