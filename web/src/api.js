import axios from 'axios';

const api = axios.create({
  // Use VITE_API_URL environment variable if present, otherwise default to Azure backend.
  // If you need to develop locally against a local backend, you can set VITE_API_URL=http://localhost:3000 in a .env file.
  baseURL: import.meta.env.VITE_API_URL || 'https://pi-5-gvfngxh8heavbvat.southafricanorth-01.azurewebsites.net',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('spendly_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('spendly_token');
      localStorage.removeItem('spendly_user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;
