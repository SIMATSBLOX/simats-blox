import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import IDEPage from './pages/IDEPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import DevicePage from './pages/DevicePage.jsx';
import RequireAuth from './components/auth/RequireAuth.jsx';
import ToastStack from './components/ui/ToastStack.jsx';
import { initSupabaseAuth } from './lib/authService.js';
import { refreshPersistTarget } from './lib/cloudRouting.js';
import { useAuthStore } from './store/authStore.js';

/** Old `/dashboard/device/:id` URLs → `/devices/:id` */
function LegacyDashboardDeviceRedirect() {
  const { deviceId } = useParams();
  const to = deviceId != null && deviceId !== '' ? `/devices/${encodeURIComponent(deviceId)}` : '/devices';
  return <Navigate to={to} replace />;
}

export default function App() {
  useEffect(() => {
    const unsubSupabase = initSupabaseAuth();
    const unsubExpress = useAuthStore.subscribe(() => refreshPersistTarget());
    refreshPersistTarget();
    return () => {
      unsubSupabase();
      unsubExpress();
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IDEPage />} />
        <Route
          path="/devices"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/devices/:deviceId"
          element={
            <RequireAuth>
              <DevicePage />
            </RequireAuth>
          }
        />
        <Route path="/dashboard" element={<Navigate to="/devices" replace />} />
        <Route path="/dashboard/device/:deviceId" element={<LegacyDashboardDeviceRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastStack />
    </BrowserRouter>
  );
}
