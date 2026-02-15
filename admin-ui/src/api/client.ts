import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/admin',
});

apiClient.interceptors.request.use((config) => {
  const apiKey = sessionStorage.getItem('adminApiKey');
  if (apiKey) {
    config.headers['x-admin-api-key'] = apiKey;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('adminApiKey');
      window.location.href = '/console/login';
    }
    return Promise.reject(error);
  },
);

export default apiClient;
