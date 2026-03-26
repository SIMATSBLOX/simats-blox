/**
 * Short ESP32 / Web Serial copy for toasts and UI (single place to tune testing UX).
 */

export const SERIAL_MSG = {
  noPortSelected: 'No port selected — try Connect again and pick your USB device.',
  browserUnsupported: 'Browser serial is supported in Chrome / Edge / Opera only.',
  secureContext: 'Web Serial needs a secure context (HTTPS or localhost).',
  serialBlocked: 'Serial access was blocked — allow the port prompt or use HTTPS / localhost.',
  notConnected: 'Not connected — use Connect in the toolbar first.',
  esp32Only: 'That action is for ESP32 · MicroPython only.',
  busyPipeline: 'Busy — wait for the current serial action to finish.',
  connectedNoData:
    'Connected — waiting for data. If the screen stays empty, your script may not be printing yet. For ESP32 MicroPython, try 115200 baud and Disconnect → Connect if text looks like garbage.',
  connectedNoDataEsp32Hint:
    'Garbage or no text? Baud must match the board (MicroPython often 115200). Disconnect → Connect after changing baud.',
  deviceDisconnected: 'Device disconnected — use Connect to pick the port again.',
  reconnectAfterBaud: 'Reconnect required after baud change — Disconnect, then Connect.',
  uploadStarted: 'Upload started — progress dialog will show each step.',
  uploadFinished: 'Upload finished — main.py saved and run started. Check Serial Monitor for board output.',
  interruptSent: 'Interrupt sent.',
  runAgainStarted: 'Run again started.',
  runAgainFinished: 'Run again finished — check Serial Monitor for output.',
};
