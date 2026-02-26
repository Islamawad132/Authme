import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllRealms } from '../api/realms';
import apiClient from '../api/client';

export function useAuth() {
  const navigate = useNavigate();

  const isAuthenticated =
    !!sessionStorage.getItem('adminApiKey') ||
    !!sessionStorage.getItem('adminToken');

  const clearAuthState = useCallback(() => {
    sessionStorage.removeItem('adminApiKey');
    sessionStorage.removeItem('adminToken');
  }, []);

  const login = useCallback(
    async (apiKey: string): Promise<boolean> => {
      clearAuthState();
      sessionStorage.setItem('adminApiKey', apiKey);
      try {
        await getAllRealms();
        return true;
      } catch {
        sessionStorage.removeItem('adminApiKey');
        return false;
      }
    },
    [clearAuthState],
  );

  const loginWithCredentials = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      clearAuthState();
      try {
        const { data } = await apiClient.post('/auth/login', { username, password });
        if (data.access_token) {
          sessionStorage.setItem('adminToken', data.access_token);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [clearAuthState],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Best-effort: clear locally even if server call fails
    }
    clearAuthState();
    navigate('/console/login');
  }, [clearAuthState, navigate]);

  return { isAuthenticated, login, loginWithCredentials, logout, clearAuthState };
}
