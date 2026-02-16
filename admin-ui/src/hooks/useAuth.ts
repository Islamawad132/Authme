import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllRealms } from '../api/realms';
import apiClient from '../api/client';

export function useAuth() {
  const navigate = useNavigate();

  const isAuthenticated =
    !!sessionStorage.getItem('adminApiKey') ||
    !!sessionStorage.getItem('adminToken');

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

  const loginWithCredentials = useCallback(
    async (username: string, password: string): Promise<boolean> => {
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
    [],
  );

  const logout = useCallback(() => {
    sessionStorage.removeItem('adminApiKey');
    sessionStorage.removeItem('adminToken');
    navigate('/console/login');
  }, [navigate]);

  return { isAuthenticated, login, loginWithCredentials, logout };
}
