import axios from 'axios';

const api = axios.create({
  baseURL: window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://api.hugozera.space',
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
