/** @typedef {'arduino_uno' | 'esp32'} BoardId */

/**
 * Short hint next to the code preview panel title (read-only / workflow).
 * @param {BoardId} boardId
 */
export function codePreviewHeaderHint(boardId) {
  return boardId === 'esp32'
    ? 'Read-only MicroPython — Upload writes main.py over USB when connected, or Export Code (.py).'
    : 'Read-only Arduino C++ — Export Code (.ino) for Arduino IDE; USB flash is manual in this IDE.';
}

/**
 * Default comment when the preview is empty.
 * @param {BoardId} boardId
 */
export function codePreviewPlaceholderComment(boardId) {
  return boardId === 'esp32'
    ? '// Stack blocks under “when ESP32 starts” (setup) and repeat-forever (loop). Live MicroPython preview.'
    : '// Stack blocks under “when board starts” (setup) and repeat-forever (loop). Live Arduino C++ preview.';
}

/**
 * Toolbar Connect button native tooltip.
 * @param {BoardId} boardId
 * @param {{ connectState: string, serialBaudRate: number, webSerialOk: boolean, webSerialMessage: string }} opts
 */
export function serialConnectButtonTitle(boardId, opts) {
  const { connectState, serialBaudRate, webSerialOk, webSerialMessage } = opts;
  if (connectState === 'connected') return 'Disconnect USB serial';
  if (connectState === 'connecting') return 'Opening serial port…';
  if (!webSerialOk) return webSerialMessage;
  if (boardId === 'esp32') {
    return `Connect USB serial at ${serialBaudRate} baud — MicroPython REPL is often 115200; set baud below, then Connect.`;
  }
  return `Connect USB serial at ${serialBaudRate} baud — match Serial.begin(...) in your sketch (Arduino Uno: often 9600).`;
}

/**
 * Log line after a successful serial connect.
 * @param {BoardId} boardId
 * @param {number} baud
 */
export function serialConnectedLogLine(boardId, baud) {
  if (boardId === 'esp32') {
    return `Serial connected at ${baud} baud. ESP32 MicroPython: USB REPL is usually 115200 — match baud if output is garbled, then use Serial Monitor.`;
  }
  return `Serial connected at ${baud} baud. Arduino Uno: match the baud in Serial.begin() from your exported .ino (often 9600).`;
}

/**
 * Upload button tooltip (full sentence; Uno explains manual workflow).
 * @param {BoardId} boardId
 * @param {'disconnected' | 'connecting' | 'connected'} connectState
 * @param {boolean} serialPipelineBusy
 * @param {boolean} [esp32UploadModalOpen] — ESP32 upload progress dialog is open
 */
export function uploadButtonTitle(boardId, connectState, serialPipelineBusy, esp32UploadModalOpen = false) {
  if (boardId !== 'esp32') {
    return 'Arduino Uno: no in-browser flash — Export Code (.ino), open in Arduino IDE, pick board & port, then Upload. This toolbar only streams serial.';
  }
  if (connectState !== 'connected') {
    return 'Connect USB serial first, then upload generated MicroPython to main.py (raw REPL)';
  }
  if (esp32UploadModalOpen) return 'Upload in progress — wait for the dialog to finish or dismiss it';
  if (serialPipelineBusy) return 'Serial busy — wait for the current action';
  return 'Write preview code to main.py on the board and run it (MicroPython raw REPL)';
}

/**
 * Toast when Uno user clicks Upload (behavior unchanged; copy only).
 */
export function unoUploadGuidanceToast() {
  return 'Arduino Uno: use Export Code (.ino), then Arduino IDE (or avrdude) to flash. Connect here is for Serial Monitor only.';
}

/**
 * Log line when Uno user clicks Upload.
 */
export function unoUploadGuidanceLog() {
  return 'Arduino Uno: no USB upload in this IDE — Export Code (.ino), open in Arduino IDE, select Arduino Uno & port, then Upload. Use Connect to watch Serial.print output.';
}

/**
 * Toast after Export Code.
 * @param {BoardId} boardId
 */
export function exportCodeSuccessToast(boardId) {
  return boardId === 'esp32'
    ? 'MicroPython (.py) exported — copy to the board or use Upload when connected.'
    : 'Arduino sketch (.ino) exported — open in Arduino IDE to compile and upload.';
}

/**
 * File / Export submenu title for “Export Code”.
 * @param {BoardId} boardId
 */
export function exportCodeMenuItemTitle(boardId) {
  return boardId === 'esp32'
    ? 'Download MicroPython script (.py) from the right-hand preview'
    : 'Download Arduino sketch (.ino) from the right-hand preview';
}

/**
 * Hover title on the compact Export dropdown (toolbar).
 * @param {BoardId} boardId
 */
export function exportToolbarMenuTitle(boardId) {
  return boardId === 'esp32'
    ? 'Export project (.json), MicroPython (.py), or workspace XML'
    : 'Export project (.json), Arduino sketch (.ino), or workspace XML';
}

/**
 * Serial Monitor strip when not connected (baud + board defaults).
 * @param {BoardId} boardId
 * @param {number} serialBaudRate
 */
export function consoleSerialDisconnectedCopy(boardId, serialBaudRate) {
  if (boardId === 'esp32') {
    return `Not connected. Toolbar Connect opens the port at ${serialBaudRate} baud — ESP32 MicroPython USB serial is usually 115200 (set below before connecting).`;
  }
  return `Not connected. Toolbar Connect opens the port at ${serialBaudRate} baud — Arduino Uno USB CDC is usually 9600 to match typical Serial.begin(9600).`;
}

/**
 * Examples dropdown: one line under the board name.
 * @param {BoardId} boardId
 */
export function examplesMenuBoardBlurb(boardId) {
  return boardId === 'esp32'
    ? 'MicroPython examples — same topics as Uno, ESP32 wiring.'
    : 'Arduino C++ examples — same topics as ESP32, Uno wiring.';
}

/**
 * Open Serial Monitor (toolbar) button title.
 * @param {BoardId} boardId
 */
export function openSerialMonitorTitle(boardId) {
  return boardId === 'esp32'
    ? 'Open Serial Monitor — stream MicroPython REPL / print output (baud must match Connect)'
    : 'Open Serial Monitor — stream Arduino Serial output (baud must match Serial.begin)';
}
