import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllRealms } from '../api/realms';

export function useAuth() {
  const navigate = useNavigate();

  const isAuthenticated = useMemo(
    () => !!sessionStorage.getItem('adminApiKey'),
    [],
  );

  const login = useCallback(
    async (apiKey: string): Promise<boolean> => {
      sessionStorage.setItem('adminApiKey', apiKey);
      try {
        await getAllRealms();
        return true;
      } catch {
        sessionStorage.removeItem('adminApiKey');
        return false;
      }
    },
    [],
  );

  const logout = useCallback(() => {
    sessionStorage.removeItem('adminApiKey');
    navigate('/console/login');
  }, [navigate]);

  return { isAuthenticated, login, logout };
}
