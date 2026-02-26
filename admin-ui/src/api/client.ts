import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/admin',
});

apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('adminToken');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  const apiKey = sessionStorage.getItem('adminApiKey');
  if (apiKey) {
    config.headers['x-admin-api-key'] = apiKey;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isOnLoginPage = window.location.pathname === '/console/login';
    if (error.response?.status === 401 && !isOnLoginPage) {
      sessionStorage.removeItem('adminApiKey');
      sessionStorage.removeItem('adminToken');
      window.location.href = '/console/login';
    }
    return Promise.reject(error);
  },
);

export default apiClient;
