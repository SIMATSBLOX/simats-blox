import { getReadingsPostUrl } from './apiConfig.js';
import { getSensorPresetByType } from './sensorAddPresets.js';

const SUPPORTED_SENSOR_TYPES = new Set(['dht11', 'soil_moisture', 'ultrasonic', 'ir_sensor', 'lm35']);

/** True when we can emit complete firmware (real device key only — no placeholders for learners). */
export function hasUsableDeviceKeyForSamples(apiKey) {
  return Boolean(String(apiKey ?? '').trim());
}

/** @param {string} s */
function cEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
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
 * @returns {{ label: string; arduino: string; micropython: string } | null}
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
  const label = preset ? `${preset.title} — ${preset.subtitle}` : sensorType;
  switch (sensorType) {
    case 'dht11':
      return {
        label,
        arduino: buildEsp32Dht11ArduinoSketch(base),
        micropython: buildEsp32Dht11MicroPythonScript(base),
      };
    case 'soil_moisture':
      return {
        label,
        arduino: buildEsp32SoilMoistureArduino(base),
        micropython: buildEsp32SoilMoistureMicroPython(base),
      };
    case 'ultrasonic':
      return {
        label,
        arduino: buildEsp32UltrasonicArduino(base),
        micropython: buildEsp32UltrasonicMicroPython(base),
      };
    case 'ir_sensor':
      return {
        label,
        arduino: buildEsp32IrArduino(base),
        micropython: buildEsp32IrMicroPython(base),
      };
    case 'lm35':
      return {
        label,
        arduino: buildEsp32Lm35Arduino(base),
        micropython: buildEsp32Lm35MicroPython(base),
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
function buildEsp32Dht11ArduinoSketch(p) {
  const readUrl = p.readingsUrl || getReadingsPostUrl();
  const deviceId = String(p.deviceId ?? '').trim() || 'your_device_id';
  const key = String(p.apiKey ?? '').trim();
  return `/*
 * SIMATS BLOX — ESP32 + DHT11 → POST /api/readings
 *
 * Board: ESP32 (Arduino-ESP32 core 2.x+).
 * Libraries (Arduino Library Manager):
 *   - "DHT sensor library" by Adafruit
 *   - "Adafruit Unified Sensor"
 *   - "ArduinoJson" by Benoit Blanchon (v6)
 *
 * Wiring: DHT11 DATA -> GPIO 4, VCC -> 3.3V, GND -> GND (10k pull-up on DATA if needed).
 *
 * Fill WIFI_SSID / WIFI_PASS. Device ID, key, and URL are filled from the app when you copy.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "DHT.h"

#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASS = "YOUR_WIFI_PASSWORD";

const char *READINGS_URL = "${cEscape(readUrl)}";
const char *DEVICE_ID = "${cEscape(deviceId)}";
const char *DEVICE_KEY = "${cEscape(key)}";

void setup() {
  Serial.begin(115200);
  delay(500);
  dht.begin();

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println(" OK");
}

void loop() {
  delay(2000);

  float h = dht.readHumidity();
  float t = dht.readTemperature(); // Celsius
  if (isnan(h) || isnan(t)) {
    Serial.println("DHT read failed, retry later");
    return;
  }

  WiFiClient client;
  HTTPClient http;
  http.begin(client, READINGS_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);

  StaticJsonDocument<288> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["sensorType"] = "dht11";
  JsonObject dataObj = doc.createNestedObject("data");
  dataObj["temperature"] = t;
  dataObj["humidity"] = h;

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  Serial.printf("POST readings -> HTTP %d\\n", code);
  if (code < 0) {
    Serial.println("HTTP request failed (check URL and Wi-Fi)");
  }
  http.end();
}
`;
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

function buildEsp32SoilMoistureArduino(p) {
  const readUrl = p.readingsUrl || getReadingsPostUrl();
  const deviceId = String(p.deviceId ?? '').trim() || 'your_device_id';
  const key = String(p.apiKey ?? '').trim();
  return `/*
 * SIMATS BLOX — ESP32 soil moisture → POST JSON
 * Analog pin 34 (ADC1). Calibrate dry/wet in your environment.
 */
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const int SOIL_PIN = 34;

const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char *READINGS_URL = "${cEscape(readUrl)}";
const char *DEVICE_ID = "${cEscape(deviceId)}";
const char *DEVICE_KEY = "${cEscape(key)}";

void setup() {
  Serial.begin(115200);
  delay(300);
  analogSetAttenuation(ADC_11db);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(400); Serial.print("."); }
  Serial.println(" WiFi OK");
}

void loop() {
  delay(5000);
  int v = analogRead(SOIL_PIN);

  WiFiClient client;
  HTTPClient http;
  http.begin(client, READINGS_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);

  StaticJsonDocument<192> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["sensorType"] = "soil_moisture";
  JsonObject dataObj = doc.createNestedObject("data");
  dataObj["soilMoisture"] = v;

  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  Serial.printf("HTTP %d\\n", code);
  http.end();
}
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

function buildEsp32UltrasonicArduino(p) {
  const readUrl = p.readingsUrl || getReadingsPostUrl();
  const deviceId = String(p.deviceId ?? '').trim() || 'your_device_id';
  const key = String(p.apiKey ?? '').trim();
  return `/*
 * SIMATS BLOX — ESP32 HC-SR04 style → distanceCm JSON
 * Trig GPIO 5, Echo GPIO 18 (3.3V-safe wiring / level shift if needed).
 */
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const int TRIG = 5;
const int ECHO = 18;

const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char *READINGS_URL = "${cEscape(readUrl)}";
const char *DEVICE_ID = "${cEscape(deviceId)}";
const char *DEVICE_KEY = "${cEscape(key)}";

float readDistanceCm() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long dur = pulseIn(ECHO, HIGH, 30000);
  if (dur <= 0) return -1;
  return (dur / 2.0f) / 29.1f;
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(400); Serial.print("."); }
  Serial.println(" WiFi OK");
}

void loop() {
  delay(2000);
  float cm = readDistanceCm();

  WiFiClient client;
  HTTPClient http;
  http.begin(client, READINGS_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);

  StaticJsonDocument<192> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["sensorType"] = "ultrasonic";
  JsonObject dataObj = doc.createNestedObject("data");
  dataObj["distanceCm"] = cm > 0 ? cm : 0.0f;

  String body;
  serializeJson(doc, body);
  http.POST(body);
  http.end();
}
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

function buildEsp32IrArduino(p) {
  const readUrl = p.readingsUrl || getReadingsPostUrl();
  const deviceId = String(p.deviceId ?? '').trim() || 'your_device_id';
  const key = String(p.apiKey ?? '').trim();
  return `/*
 * SIMATS BLOX — IR obstacle sensor → irDetected JSON
 * GPIO 5, INPUT_PULLUP (adjust HIGH/LOW to match your module).
 */
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const int IR_PIN = 5;

const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char *READINGS_URL = "${cEscape(readUrl)}";
const char *DEVICE_ID = "${cEscape(deviceId)}";
const char *DEVICE_KEY = "${cEscape(key)}";

void setup() {
  Serial.begin(115200);
  pinMode(IR_PIN, INPUT_PULLUP);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(400); Serial.print("."); }
  Serial.println(" WiFi OK");
}

void loop() {
  delay(1500);
  bool detected = digitalRead(IR_PIN) == LOW;

  WiFiClient client;
  HTTPClient http;
  http.begin(client, READINGS_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);

  StaticJsonDocument<192> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["sensorType"] = "ir_sensor";
  JsonObject dataObj = doc.createNestedObject("data");
  dataObj["irDetected"] = detected;

  String body;
  serializeJson(doc, body);
  http.POST(body);
  http.end();
}
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
IR = Pin(5, Pin.IN, Pin.PULL_UP)
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

function buildEsp32Lm35Arduino(p) {
  const readUrl = p.readingsUrl || getReadingsPostUrl();
  const deviceId = String(p.deviceId ?? '').trim() || 'your_device_id';
  const key = String(p.apiKey ?? '').trim();
  return `/*
 * SIMATS BLOX — LM35 on ADC → temperature JSON
 * GPIO35 ADC example; calibrate for your wiring and reference voltage.
 */
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const int LM35_PIN = 35;

const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char *READINGS_URL = "${cEscape(readUrl)}";
const char *DEVICE_ID = "${cEscape(deviceId)}";
const char *DEVICE_KEY = "${cEscape(key)}";

float readLm35C() {
  int raw = analogRead(LM35_PIN);
  float mv = (raw / 4095.0f) * 3300.0f;
  return mv / 10.0f;
}

void setup() {
  Serial.begin(115200);
  analogSetAttenuation(ADC_11db);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(400); Serial.print("."); }
  Serial.println(" WiFi OK");
}

void loop() {
  delay(3000);
  float t = readLm35C();

  WiFiClient client;
  HTTPClient http;
  http.begin(client, READINGS_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);

  StaticJsonDocument<192> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["sensorType"] = "lm35";
  JsonObject dataObj = doc.createNestedObject("data");
  dataObj["temperature"] = t;

  String body;
  serializeJson(doc, body);
  http.POST(body);
  http.end();
}
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
