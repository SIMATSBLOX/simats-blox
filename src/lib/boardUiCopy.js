/**
 * MicroPython / ESP32-only UI strings for the IDE toolbar, code preview, and console.
 */

export function codePreviewHeaderHint() {
  return 'Read-only MicroPython — Upload writes main.py over USB when connected, or Export Code (.py).';
}

export function codePreviewPlaceholderComment() {
  return '// Stack blocks under “when ESP32 starts” (setup) and repeat-forever (loop). Live MicroPython preview.';
}

/**
 * Toolbar Connect button native tooltip.
 * @param {{ connectState: string, serialBaudRate: number, webSerialOk: boolean, webSerialMessage: string }} opts
 */
export function serialConnectButtonTitle(opts) {
  const { connectState, serialBaudRate, webSerialOk, webSerialMessage } = opts;
  if (connectState === 'connected') return 'Disconnect USB serial';
  if (connectState === 'connecting') return 'Opening serial port…';
  if (!webSerialOk) return webSerialMessage;
  return `Connect USB serial at ${serialBaudRate} baud — MicroPython REPL is often 115200; set baud below, then Connect.`;
}

/**
 * Log line after a successful serial connect.
 * @param {number} baud
 */
export function serialConnectedLogLine(baud) {
  return `Serial connected at ${baud} baud. ESP32 MicroPython: USB REPL is usually 115200 — match baud if output is garbled, then use Serial Monitor.`;
}

/**
 * Upload button tooltip.
 * @param {'disconnected' | 'connecting' | 'connected'} connectState
 * @param {boolean} serialPipelineBusy
 * @param {boolean} [esp32UploadModalOpen]
 */
export function uploadButtonTitle(connectState, serialPipelineBusy, esp32UploadModalOpen = false) {
  if (connectState !== 'connected') {
    return 'Connect USB serial first, then upload generated MicroPython to main.py (raw REPL)';
  }
  if (esp32UploadModalOpen) return 'Upload in progress — wait for the dialog to finish or dismiss it';
  if (serialPipelineBusy) return 'Serial busy — wait for the current action';
  return 'Write preview code to main.py on the board and run it (MicroPython raw REPL)';
}

/** @returns {string} */
export function exportCodeSuccessToast() {
  return 'MicroPython (.py) exported — copy to the board or use Upload when connected.';
}

/** @returns {string} */
export function exportCodeMenuItemTitle() {
  return 'Download MicroPython script (.py) from the right-hand preview';
}

/** @returns {string} */
export function exportToolbarMenuTitle() {
  return 'Export project (.json), MicroPython (.py), or workspace XML';
}

/**
 * Serial Monitor strip when not connected (baud + board defaults).
 * @param {number} serialBaudRate
 */
export function consoleSerialDisconnectedCopy(serialBaudRate) {
  return `Not connected. Toolbar Connect opens the port at ${serialBaudRate} baud — ESP32 MicroPython USB serial is usually 115200 (set below before connecting).`;
}

/** @returns {string} */
export function examplesMenuBoardBlurb() {
  return 'Starter MicroPython examples for ESP32.';
}

/** @returns {string} */
export function openSerialMonitorTitle() {
  return 'Open Serial Monitor — stream MicroPython REPL / print output (baud must match Connect)';
}
