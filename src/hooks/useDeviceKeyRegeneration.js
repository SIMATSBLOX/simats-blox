import { useCallback, useState } from 'react';
import { regenerateDeviceKey } from '../api/readingApi.js';
import { rememberDeviceApiKey } from '../lib/deviceKeyStorage.js';
import { toast } from '../lib/toast.js';

/**
 * @param {string} deviceId
 * @param {string} [deviceLabel]
 * @param {() => void} [onAfterRegenerate]
 */
export function useDeviceKeyRegeneration(deviceId, deviceLabel, onAfterRegenerate) {
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState(/** @type {string | null} */ (null));

  const run = useCallback(async () => {
    if (!deviceId) return;
    const label = deviceLabel || deviceId;
    const ok = window.confirm(
      `Create a new device key for “${label}”? The old key stops immediately — update your board and tap “Save for IDE & samples” if you use this browser.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await regenerateDeviceKey(deviceId);
      const key = typeof res.apiKey === 'string' ? res.apiKey : null;
      if (!key) throw new Error('No key returned.');
      setNewKey(key);
      toast('success', 'New key ready. Copy it now — it won’t show again.');
      onAfterRegenerate?.();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Could not regenerate key.');
    } finally {
      setBusy(false);
    }
  }, [deviceId, deviceLabel, onAfterRegenerate]);

  const copyKey = useCallback(async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      toast('success', 'Key copied.');
    } catch {
      toast('error', 'Could not copy.');
    }
  }, [newKey]);

  const saveInBrowser = useCallback(() => {
    if (!newKey || !deviceId) return;
    rememberDeviceApiKey(deviceId, newKey);
    toast('success', 'Saved in this browser for sample code and the IDE.');
  }, [deviceId, newKey]);

  const dismiss = useCallback(() => setNewKey(null), []);

  return { busy, newKey, run, copyKey, saveInBrowser, dismiss };
}
