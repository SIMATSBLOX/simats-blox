import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import IDEPage from './pages/IDEPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import DevicePage from './pages/DevicePage.jsx';
import RequireAuth from './components/auth/RequireAuth.jsx';
import ToastStack from './components/ui/ToastStack.jsx';
import { initSupabaseAuth } from './lib/authService.js';
import { refreshPersistTarget } from './lib/cloudRouting.js';
import { useAuthStore } from './store/authStore.js';

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
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard/device/:deviceId"
          element={
            <RequireAuth>
              <DevicePage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastStack />
    </BrowserRouter>
  );
}
