/**
 * Axios client for the admin API.
 *
 * Credentials are stored in module-level variables (heap memory) rather than
 * sessionStorage, preventing XSS scripts from reading them via the Storage API
 * (issue #330).  The React AuthContext keeps these variables up to date through
 * the exported helpers below.
 */

import axios from 'axios';

// ---------------------------------------------------------------------------
// In-memory credential store — module-level, never written to Web Storage.
// ---------------------------------------------------------------------------
let _apiKey: string | null = null;
let _token: string | null = null;

/** Called by AuthContext after a successful login. */
export function setCredentials(opts: { apiKey?: string; token?: string }) {
  _apiKey = opts.apiKey ?? null;
  _token = opts.token ?? null;
}

/** Called on logout or a 401 response. */
export function clearCredentials() {
  _apiKey = null;
  _token = null;
}

/** Returns true when any credential is present (used by ProtectedRoute). */
export function hasCredentials(): boolean {
  return _apiKey !== null || _token !== null;
}

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------
const apiClient = axios.create({
  baseURL: '/admin',
});

apiClient.interceptors.request.use((config) => {
  if (_token) {
    config.headers['Authorization'] = `Bearer ${_token}`;
  }
  if (_apiKey) {
    config.headers['x-admin-api-key'] = _apiKey;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isOnLoginPage = window.location.pathname === '/console/login';
    if (error.response?.status === 401 && !isOnLoginPage) {
      clearCredentials();
      window.location.href = '/console/login';
    }
    return Promise.reject(error);
  },
);

export default apiClient;
