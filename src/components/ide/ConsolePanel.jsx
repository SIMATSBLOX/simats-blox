import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import Panel from '../ui/Panel.jsx';
import Tabs from '../ui/Tabs.jsx';
import Button from '../ui/Button.jsx';
import { BOARD_LABEL, SERIAL_BAUD_PRESETS, useIdeStore } from '../../store/ideStore.js';
import { formatWebSerialError, getWebSerialAvailability, writeSerialText } from '../../lib/webSerialService.js';
import { rerunMicroPythonMainPy, sendMicroPythonInterrupt } from '../../lib/micropythonSerialUpload.js';
import { SERIAL_MSG } from '../../lib/serialUserMessages.js';
import { toast } from '../../lib/toast.js';
import { consoleSerialDisconnectedCopy } from '../../lib/boardUiCopy.js';
import Esp32MpyProgressModal from './Esp32MpyProgressModal.jsx';
import { mapMpyStepToProgress } from '../../lib/mpyProgressPhases.js';
import { useDashboardSession } from '../../hooks/useDashboardSession.js';
import { fetchDeviceList, postDeviceReading } from '../../api/readingApi.js';
import { getStoredDeviceApiKey } from '../../lib/deviceKeyStorage.js';
import { parseSerialLineToReading } from '../../lib/serialReadingBridge.js';

const LS_FWD = 'simats_serial_forward_enabled';
const LS_DEV = 'simats_serial_forward_device_id';

export default function ConsolePanel() {
  const [tab, setTab] = useState('log');
  const [sendDraft, setSendDraft] = useState('');
  const [appendNewline, setAppendNewline] = useState(true);
  const [sendHint, setSendHint] = useState(/** @type {{ kind: 'ok' | 'err'; msg: string } | null} */ (null));
  const [rerunProgressModal, setRerunProgressModal] = useState(
    /** @type {null | { runState: 'running' | 'success' | 'error', phase: string, percent: number, error: string }} */ (null),
  );

  const logLines = useIdeStore((s) => s.logLines);
  const serialLines = useIdeStore((s) => s.serialLines);
  const serialHistoryTrimmed = useIdeStore((s) => s.serialHistoryTrimmed);
  const clearSerial = useIdeStore((s) => s.clearSerial);
  const connectState = useIdeStore((s) => s.connectState);
  const serialTabFocusKey = useIdeStore((s) => s.serialTabFocusKey);
  const boardId = useIdeStore((s) => s.boardId);
  const serialBaudRate = useIdeStore((s) => s.serialBaudRate);
  const setSerialBaudRate = useIdeStore((s) => s.setSerialBaudRate);
  const appendLog = useIdeStore((s) => s.appendLog);
  const serialPipelineBusy = useIdeStore((s) => s.serialPipelineBusy);
  const setSerialPipelineBusy = useIdeStore((s) => s.setSerialPipelineBusy);
  const lastSerialLine = useIdeStore((s) => {
    const L = s.serialLines;
    return L.length ? L[L.length - 1] : null;
  });

  const { isAuthenticated } = useDashboardSession();
  const [bridgeDevices, setBridgeDevices] = useState(/** @type {object[]} */ ([]));
  const [forwardEnabled, setForwardEnabled] = useState(() => {
    try {
      return localStorage.getItem(LS_FWD) === '1';
    } catch {
      return false;
    }
  });
  const [forwardTargetId, setForwardTargetId] = useState(() => {
    try {
      return localStorage.getItem(LS_DEV) || '';
    } catch {
      return '';
    }
  });

  const serialScrollRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  /** When true, new serial output auto-scrolls to the bottom; false if user scrolled up to read. */
  const stickSerialToBottomRef = useRef(true);
  const hintTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const processedSerialIdRef = useRef(/** @type {string | null} */ (null));
  const lastReadingPostAtRef = useRef(0);

  const SERIAL_STICK_BOTTOM_PX = 72;

  const refreshBridgeDevices = useCallback(async () => {
    if (!isAuthenticated) {
      setBridgeDevices([]);
      return;
    }
    try {
      const { devices: list } = await fetchDeviceList();
      const arr = Array.isArray(list) ? list : [];
      setBridgeDevices(arr.filter((d) => getStoredDeviceApiKey(d.deviceId)));
    } catch {
      setBridgeDevices([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (tab !== 'serial') return undefined;
    void refreshBridgeDevices();
    const onKeys = () => void refreshBridgeDevices();
    window.addEventListener('simats-device-keys-changed', onKeys);
    return () => window.removeEventListener('simats-device-keys-changed', onKeys);
  }, [tab, refreshBridgeDevices]);

  useEffect(() => {
    if (bridgeDevices.length === 0) return;
    const ids = new Set(bridgeDevices.map((d) => d.deviceId));
    if (!forwardTargetId || !ids.has(forwardTargetId)) {
      const next = bridgeDevices[0].deviceId;
      setForwardTargetId(next);
      try {
        localStorage.setItem(LS_DEV, next);
      } catch {
        /* ignore */
      }
    }
  }, [bridgeDevices, forwardTargetId]);

  useEffect(() => {
    if (!forwardEnabled || !isAuthenticated || !lastSerialLine) return;
    if (lastSerialLine.id === processedSerialIdRef.current) return;

    const apiKey = getStoredDeviceApiKey(forwardTargetId);
    const dev = bridgeDevices.find((d) => d.deviceId === forwardTargetId);
    if (!apiKey || !dev) {
      processedSerialIdRef.current = lastSerialLine.id;
      return;
    }

    const payload = parseSerialLineToReading(lastSerialLine.text, {
      deviceId: forwardTargetId,
      sensorType: dev.sensorType,
    });
    processedSerialIdRef.current = lastSerialLine.id;
    if (!payload) return;

    const now = Date.now();
    if (now - lastReadingPostAtRef.current < 1000) return;
    lastReadingPostAtRef.current = now;

    void postDeviceReading(apiKey, payload).catch((e) => {
      toast('error', e instanceof Error ? e.message : 'Could not send reading to Devices');
    });
  }, [
    forwardEnabled,
    isAuthenticated,
    forwardTargetId,
    bridgeDevices,
    lastSerialLine?.id,
    lastSerialLine?.text,
  ]);

  const persistForwardEnabled = (on) => {
    setForwardEnabled(on);
    try {
      if (on) localStorage.setItem(LS_FWD, '1');
      else localStorage.removeItem(LS_FWD);
    } catch {
      /* ignore */
    }
  };

  const persistForwardTarget = (id) => {
    setForwardTargetId(id);
    try {
      if (id) localStorage.setItem(LS_DEV, id);
      else localStorage.removeItem(LS_DEV);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    setTab('serial');
  }, [serialTabFocusKey]);

  const onSerialScroll = () => {
    const el = serialScrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickSerialToBottomRef.current = dist < SERIAL_STICK_BOTTOM_PX;
  };

  useLayoutEffect(() => {
    if (tab !== 'serial' || !serialScrollRef.current) return;
    const el = serialScrollRef.current;
    if (stickSerialToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [serialLines, tab]);

  useEffect(() => {
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, []);

  const showSendHint = (hint) => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    setSendHint(hint);
    hintTimerRef.current = setTimeout(() => setSendHint(null), 2200);
  };

  const serialAvailability = getWebSerialAvailability();
  const canSend = serialAvailability.ok && connectState === 'connected' && !serialPipelineBusy;
  const canMpSession =
    boardId === 'esp32' && serialAvailability.ok && connectState === 'connected' && !serialPipelineBusy;

  const handleBaudChange = (e) => {
    const v = Number(e.target.value);
    setSerialBaudRate(v);
    const msg =
      connectState === 'connected'
        ? `${SERIAL_MSG.reconnectAfterBaud} (now ${v} baud selected).`
        : boardId === 'esp32'
          ? `Baud ${v} for next Connect — ESP32 MicroPython USB is often 115200.`
          : `Baud ${v} for next Connect — Arduino Uno Serial Monitor usually matches Serial.begin (often 9600).`;
    toast('info', msg);
  };

  const handleSend = async () => {
    if (useIdeStore.getState().serialPipelineBusy) {
      toast('info', SERIAL_MSG.busyPipeline);
      showSendHint({ kind: 'err', msg: SERIAL_MSG.busyPipeline });
      return;
    }
    if (!serialAvailability.ok) {
      toast('error', serialAvailability.message);
      showSendHint({ kind: 'err', msg: serialAvailability.message });
      return;
    }
    if (connectState !== 'connected') {
      toast('error', SERIAL_MSG.notConnected);
      showSendHint({ kind: 'err', msg: SERIAL_MSG.notConnected });
      return;
    }
    const raw = sendDraft;
    const payload = appendNewline ? `${raw}\n` : raw;
    if (payload.length === 0) {
      const msg = 'Nothing to send.';
      showSendHint({ kind: 'err', msg });
      return;
    }

    setSerialPipelineBusy(true);
    try {
      await writeSerialText(payload);
      setSendDraft('');
      showSendHint({ kind: 'ok', msg: 'Sent.' });
    } catch (e) {
      const msg = formatWebSerialError(e);
      toast('error', msg);
      showSendHint({ kind: 'err', msg });
    } finally {
      setSerialPipelineBusy(false);
    }
  };

  const handleMpInterrupt = async () => {
    if (useIdeStore.getState().serialPipelineBusy) {
      toast('info', SERIAL_MSG.busyPipeline);
      return;
    }
    if (boardId !== 'esp32') {
      toast('info', SERIAL_MSG.esp32Only);
      return;
    }
    if (!serialAvailability.ok) {
      toast('error', serialAvailability.message);
      return;
    }
    if (connectState !== 'connected') {
      toast('error', SERIAL_MSG.notConnected);
      return;
    }
    setSerialPipelineBusy(true);
    try {
      await sendMicroPythonInterrupt();
      appendLog('info', 'MicroPython: interrupt (Ctrl+C) sent.');
      toast('info', SERIAL_MSG.interruptSent);
    } catch (e) {
      const msg = formatWebSerialError(e);
      appendLog('warn', `MicroPython interrupt failed: ${msg}`);
      toast('error', msg);
    } finally {
      setSerialPipelineBusy(false);
    }
  };

  const handleMpRerun = async () => {
    if (useIdeStore.getState().serialPipelineBusy) {
      toast('info', SERIAL_MSG.busyPipeline);
      return;
    }
    if (boardId !== 'esp32') {
      toast('info', SERIAL_MSG.esp32Only);
      return;
    }
    if (!serialAvailability.ok) {
      toast('error', serialAvailability.message);
      return;
    }
    if (connectState !== 'connected') {
      toast('error', SERIAL_MSG.notConnected);
      return;
    }
    setSerialPipelineBusy(true);
    setRerunProgressModal({ runState: 'running', phase: 'Preparing', percent: 0, error: '' });
    appendLog('info', 'MicroPython: run again (main.py) started.');
    try {
      await rerunMicroPythonMainPy({
        onStep: (label) => {
          const mapped = mapMpyStepToProgress(label, 'rerun');
          setRerunProgressModal((m) => (m && m.runState === 'running' ? { ...m, ...mapped } : m));
        },
      });
      appendLog('info', 'MicroPython: run again finished — check Serial Monitor for board output.');
      setRerunProgressModal((m) =>
        m ? { ...m, runState: 'success', phase: '', percent: 100, error: '' } : m,
      );
    } catch (e) {
      const msg = formatWebSerialError(e);
      appendLog('warn', `MicroPython run again failed: ${msg}`);
      setRerunProgressModal((m) =>
        m
          ? { ...m, runState: 'error', error: msg }
          : { runState: 'error', phase: '', percent: 0, error: msg },
      );
    } finally {
      setSerialPipelineBusy(false);
    }
  };

  const inputCls =
    'w-full rounded border border-studio-border bg-[#1b1f24] px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-studio-accent/50 focus:outline-none focus:ring-1 focus:ring-studio-accent/25 disabled:opacity-45';

  return (
    <>
    <div className="flex h-full min-h-0 shrink-0 flex-col border-t border-studio-border bg-[#1a1d22]">
      <Tabs
        activeId={tab}
        onChange={setTab}
        tabs={[
          { id: 'log', label: 'Log' },
          { id: 'serial', label: 'Serial Monitor' },
        ]}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'log' && (
          <Panel className="h-full rounded-none border-0 bg-transparent">
            <div className="h-full overflow-auto p-2 font-mono text-[11px] text-slate-300">
              {logLines.map((l) => (
                <div key={l.id} className="border-b border-studio-border/40 py-1 last:border-0">
                  <span className="text-studio-muted">[{l.level}]</span> {l.text}
                </div>
              ))}
            </div>
          </Panel>
        )}
        {tab === 'serial' && (
          <Panel
            className="h-full rounded-none border-0 bg-transparent"
            headerRight={
              <Button variant="ghost" className="!py-0.5 !text-[11px]" onClick={() => clearSerial()} title="Clear serial view">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            }
          >
            <div className="flex h-full min-h-0 flex-col gap-2 p-1">
              <div className="shrink-0 space-y-1.5 border-b border-studio-border/50 pb-2">
                <div className="text-[10px] leading-relaxed text-studio-muted">
                  {!serialAvailability.ok ? (
                    <span className="text-amber-200/85">{serialAvailability.message}</span>
                  ) : connectState === 'connected' ? (
                    <span>
                      <span className="text-emerald-400/90">● Connected</span>
                      <span className="text-slate-500"> · </span>
                      <span className="font-mono text-slate-400">{serialBaudRate}</span>
                      <span> baud</span>
                      {boardId === 'esp32' ? (
                        <>
                          <span className="text-slate-500"> · </span>
                          <span>{SERIAL_MSG.connectedNoDataEsp32Hint}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-slate-500"> · </span>
                          <span>must match Serial.begin(...) in your exported .ino (Uno: often 9600).</span>
                        </>
                      )}
                    </span>
                  ) : connectState === 'connecting' ? (
                    <span className="text-slate-400">Connecting… choose a port if the browser prompts you.</span>
                  ) : (
                    <span>{consoleSerialDisconnectedCopy(boardId, serialBaudRate)}</span>
                  )}
                </div>

                <div className="space-y-2 rounded border border-emerald-900/25 bg-[#12151a]/90 px-2 py-2">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-200/70">Devices</div>
                  <label className="flex cursor-pointer items-start gap-2 text-[11px] text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={forwardEnabled}
                      onChange={(e) => persistForwardEnabled(e.target.checked)}
                      className="mt-0.5 rounded border-studio-border bg-[#181b20] text-studio-accent focus:ring-studio-accent/40"
                    />
                    <span>
                      <span className="font-medium text-slate-200">Send lines to Devices</span>
                      <span className="text-slate-500"> — save your device key on the </span>
                      <Link to="/devices" className="text-studio-accent hover:text-studio-accentHover">
                        Devices
                      </Link>
                      <span className="text-slate-500"> page (Step 2), then connect serial here.</span>
                    </span>
                  </label>
                  {forwardEnabled ? (
                    <>
                      {!isAuthenticated ? (
                        <p className="text-[10px] leading-snug text-amber-200/85">
                          Sign in: Settings → Local API.
                        </p>
                      ) : bridgeDevices.length === 0 ? (
                        <p className="text-[10px] leading-snug text-amber-200/85">
                          Save a device key on{' '}
                          <Link to="/devices" className="text-studio-accent hover:text-studio-accentHover">
                            Devices
                          </Link>{' '}
                          page — Step 2.
                        </p>
                      ) : (
                        <label className="block text-[10px] text-studio-muted">
                          Device
                          <select
                            value={forwardTargetId}
                            onChange={(e) => persistForwardTarget(e.target.value)}
                            className="mt-0.5 w-full rounded border border-studio-border bg-[#181b20] px-2 py-1 font-mono text-[11px] text-slate-200 focus:border-studio-accent/50 focus:outline-none focus:ring-1 focus:ring-studio-accent/25"
                          >
                            {bridgeDevices.map((d) => (
                              <option key={d.deviceId} value={d.deviceId}>
                                {d.name} · {d.sensorType} ({d.deviceId})
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <p className="text-[10px] text-slate-500">DHT11: one line like “Humidity: …% Temperature: …°C”. ~1 post/sec.</p>
                    </>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="serial-baud" className="text-[10px] text-slate-500">
                    Baud
                  </label>
                  <select
                    id="serial-baud"
                    value={serialBaudRate}
                    onChange={handleBaudChange}
                    className="rounded border border-studio-border bg-[#181b20] px-2 py-1 font-mono text-[11px] text-slate-200 focus:border-studio-accent/50 focus:outline-none focus:ring-1 focus:ring-studio-accent/25"
                    aria-label="Serial baud rate for next connection"
                  >
                    {SERIAL_BAUD_PRESETS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  {connectState === 'connected' ? (
                    <span className="text-[10px] text-amber-200/80">{SERIAL_MSG.reconnectAfterBaud}</span>
                  ) : null}
                </div>
                {boardId === 'esp32' ? (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-studio-border/40 pt-2">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">MicroPython</span>
                    <Button
                      type="button"
                      variant="default"
                      className="!px-2 !py-0.5 !text-[10px]"
                      disabled={!canMpSession}
                      aria-label="Stop or interrupt MicroPython"
                      title={
                        !serialAvailability.ok
                          ? 'Web Serial not available'
                          : connectState !== 'connected'
                            ? 'Not connected'
                            : serialPipelineBusy
                              ? SERIAL_MSG.busyPipeline
                              : 'Interrupt (Ctrl+C) — stops running script'
                      }
                      onClick={() => void handleMpInterrupt()}
                    >
                      Stop
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      className="!px-2 !py-0.5 !text-[10px]"
                      disabled={!canMpSession}
                      aria-label="Run main.py again from flash"
                      title={
                        !serialAvailability.ok
                          ? 'Web Serial not available'
                          : connectState !== 'connected'
                            ? 'Not connected'
                            : serialPipelineBusy
                              ? SERIAL_MSG.busyPipeline
                              : 'Run main.py again (same path as after Upload)'
                      }
                      onClick={() => void handleMpRerun()}
                    >
                      Run again
                    </Button>
                    {connectState !== 'connected' || !serialAvailability.ok ? (
                      <span className="text-[10px] text-studio-muted">Connect for Stop / Run again (ESP32 only).</span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {serialHistoryTrimmed ? (
                <p className="shrink-0 text-[10px] leading-snug text-studio-muted">
                  Older serial output was removed to keep this tab responsive (line / size limits).
                </p>
              ) : null}

              <div
                ref={serialScrollRef}
                onScroll={onSerialScroll}
                className="min-h-0 flex-1 overflow-auto rounded border border-studio-border/40 bg-[#14171b]/90 p-2 font-mono text-[11px] leading-snug text-amber-100/95"
              >
                {serialLines.length === 0 ? (
                  <span className="text-studio-muted">
                    {connectState === 'connected'
                      ? boardId === 'esp32'
                        ? SERIAL_MSG.connectedNoData
                        : 'Connected — no bytes yet. Upload a sketch from Arduino IDE that uses Serial.print, or use Send below.'
                      : serialAvailability.ok
                        ? 'Not connected — use toolbar Connect, then open this tab to watch output.'
                        : SERIAL_MSG.browserUnsupported}
                  </span>
                ) : (
                  serialLines.map((l) => (
                    <div key={l.id} className="whitespace-pre-wrap break-all">
                      {l.text}
                    </div>
                  ))
                )}
              </div>

              <form
                className="shrink-0 space-y-1 border-t border-studio-border/50 pt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSend();
                }}
              >
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={sendDraft}
                    onChange={(e) => setSendDraft(e.target.value)}
                    placeholder={
                      canSend
                        ? 'Text to send…'
                        : connectState !== 'connected'
                          ? 'Connect to send…'
                          : SERIAL_MSG.busyPipeline
                    }
                    disabled={!canSend}
                    className={`${inputCls} min-w-0 flex-1`}
                    aria-label="Serial send buffer"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Button
                    type="submit"
                    variant="default"
                    className="!shrink-0 !px-2.5 !py-1 !text-[11px]"
                    disabled={!canSend}
                    title={
                      canSend
                        ? 'Send to device'
                        : connectState !== 'connected'
                          ? SERIAL_MSG.notConnected
                          : SERIAL_MSG.busyPipeline
                    }
                  >
                    Send
                  </Button>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[10px] text-studio-muted select-none">
                  <input
                    type="checkbox"
                    checked={appendNewline}
                    onChange={(e) => setAppendNewline(e.target.checked)}
                    className="rounded border-studio-border bg-[#181b20] text-studio-accent focus:ring-studio-accent/40"
                  />
                  Append newline (\n) after each send
                </label>
                {sendHint ? (
                  <p
                    className={
                      sendHint.kind === 'ok' ? 'text-[10px] text-emerald-400/90' : 'text-[10px] text-red-300/90'
                    }
                    role="status"
                  >
                    {sendHint.msg}
                  </p>
                ) : null}
              </form>
            </div>
          </Panel>
        )}
      </div>
    </div>

    <Esp32MpyProgressModal
      open={rerunProgressModal !== null}
      title="Running main.py again"
      phase={rerunProgressModal?.phase ?? ''}
      percent={rerunProgressModal?.percent ?? 0}
      runState={rerunProgressModal?.runState ?? 'running'}
      errorMessage={rerunProgressModal?.error ?? ''}
      successMessage="Run finished successfully"
      onClose={() => setRerunProgressModal(null)}
      onRetry={() => {
        setRerunProgressModal(null);
        void handleMpRerun();
      }}
    />
    </>
  );
}
