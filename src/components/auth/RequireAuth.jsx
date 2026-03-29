import { Navigate, useLocation } from 'react-router-dom';
import { useDashboardSession } from '../../hooks/useDashboardSession.js';

/**
 * @param {{ children: import('react').ReactNode }} props
 */
export default function RequireAuth({ children }) {
  const { isAuthenticated } = useDashboardSession();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ requireAuth: true, from: location.pathname }} />;
  }

  return children;
}
