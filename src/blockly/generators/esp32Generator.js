import { buildSketch } from './arduinoGenerator.js';
import { buildMicroPythonSketch } from './micropythonGenerator.js';

/** Arduino-ESP32 C++ (optional / legacy). */
export function buildEsp32ArduinoSketch(workspace) {
  return buildSketch(workspace, 'esp32');
}

/** ESP32 IDE preview: MicroPython. */
export function buildEsp32Sketch(workspace) {
  return buildMicroPythonSketch(workspace);
}
