import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import IDEStudio from '../components/ide/IDEStudio.jsx';
import IdeDeviceContextBanner from '../components/ide/IdeDeviceContextBanner.jsx';
import { useIdeStore } from '../store/ideStore.js';

export default function IDEPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const appendLog = useIdeStore((s) => s.appendLog);
  const showedAuthHint = useRef(false);

  const deviceId = useMemo(() => searchParams.get('device')?.trim() ?? '', [searchParams]);
  const liveMonitorDeviceId = useMemo(() => searchParams.get('monitor')?.trim() ?? '', [searchParams]);
  const liveMonitorSensorTypeHint = useMemo(() => searchParams.get('mt')?.trim() ?? '', [searchParams]);
  const kit = searchParams.get('kit') === '1';
  const typeFromUrl = searchParams.get('type')?.trim() ?? '';

  const stateCtx = location.state && typeof location.state === 'object' ? location.state.ideDeviceContext : null;
  const deviceNameFromState =
    stateCtx && typeof stateCtx.deviceName === 'string' ? stateCtx.deviceName.trim() : '';
  const sensorTypeFromState =
    stateCtx && typeof stateCtx.sensorType === 'string' ? stateCtx.sensorType.trim() : '';

  const sensorType = typeFromUrl || sensorTypeFromState;
  const deviceName = deviceNameFromState;

  const showKitBanner = Boolean(deviceId && kit);

  const dismissKitBanner = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('device');
    next.delete('kit');
    next.delete('type');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const closeLiveMonitor = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('monitor');
    next.delete('mt');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const st = location.state;
    if (st?.requireAuth && !showedAuthHint.current) {
      showedAuthHint.current = true;
      appendLog(
        'warn',
        'Sign in under Settings → Account (Local API / SIMATS account) to open Devices and live sensor monitoring.',
      );
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location.state, location.pathname, appendLog]);

  useEffect(() => {
    if (!deviceId || !kit) return undefined;
    const t = window.setTimeout(() => {
      useIdeStore.getState().focusSerialMonitorTab();
    }, 450);
    return () => window.clearTimeout(t);
  }, [deviceId, kit]);

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden">
      {showKitBanner ? (
        <IdeDeviceContextBanner
          deviceId={deviceId}
          deviceName={deviceName}
          sensorType={sensorType}
          onDismiss={dismissKitBanner}
        />
      ) : null}
      <div className="min-h-0 flex-1 overflow-hidden">
        <IDEStudio
          liveMonitorDeviceId={liveMonitorDeviceId}
          liveMonitorSensorTypeHint={liveMonitorSensorTypeHint}
          onCloseLiveMonitor={closeLiveMonitor}
        />
      </div>
    </div>
  );
}
