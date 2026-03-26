import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';

/**
 * @param {{ children: import('react').ReactNode }} props
 */
export default function RequireAuth({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ requireAuth: true, from: location.pathname }} />;
  }

  return children;
}
