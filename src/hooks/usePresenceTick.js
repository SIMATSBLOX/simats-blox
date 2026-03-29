import { useEffect, useState } from 'react';

/** Re-render periodically so stale/offline state updates without new socket events. */
export function usePresenceTick(intervalMs = 15000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
}
