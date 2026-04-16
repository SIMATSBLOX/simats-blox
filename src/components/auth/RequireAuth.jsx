import { Navigate, useLocation } from 'react-router-dom';
import { useDashboardSession } from '../../hooks/useDashboardSession.js';

/**
 * @param {{ children: import('react').ReactNode }} props
 */
export default function RequireAuth({ children }) {
  const { isAuthenticated, sessionHydrating } = useDashboardSession();
  const location = useLocation();

  if (sessionHydrating) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-studio-bg px-4 text-sm text-studio-muted">
        Loading session…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ requireAuth: true, from: location.pathname }} />;
  }

  return children;
}
