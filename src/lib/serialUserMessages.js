/**
 * Short ESP32 / Web Serial copy for toasts and UI (single place to tune testing UX).
 */

export const SERIAL_MSG = {
  noPortSelected: 'No port selected — try Connect again and pick your USB device.',
  browserUnsupported: 'Browser serial is supported in Chrome / Edge / Opera only.',
  secureContext: 'Web Serial needs a secure context (HTTPS or localhost).',
  serialBlocked: 'Serial access was blocked — allow the port prompt or use HTTPS / localhost.',
  notConnected: 'Not connected — use Connect in the toolbar first.',
  busyPipeline: 'Busy — wait for the current serial action to finish.',
  deviceDisconnected: 'Device disconnected — use Connect to pick the port again.',
  uploadStarted: 'Upload started — progress dialog will show each step.',
  interruptSent: 'Interrupt sent.',
};
