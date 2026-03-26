import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import IDEStudio from '../components/ide/IDEStudio.jsx';
import { useIdeStore } from '../store/ideStore.js';

export default function IDEPage() {
  const location = useLocation();
  const appendLog = useIdeStore((s) => s.appendLog);
  const showedAuthHint = useRef(false);

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

  return (
    <div className="h-screen min-h-0 overflow-hidden">
      <IDEStudio />
    </div>
  );
}
