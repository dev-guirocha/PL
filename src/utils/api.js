import axios from 'axios';

// Garante que o baseURL sempre aponte para o backend + /api
const fallbackProd = 'https://pl-production.up.railway.app/api'; // fallback para produção caso a env não esteja setada
const envBase = import.meta?.env?.VITE_API_BASE_URL || fallbackProd || '/api';
const baseURL = envBase.endsWith('/api') ? envBase : `${envBase.replace(/\/$/, '')}/api`;

// Axios pré-configurado para enviar cookies HttpOnly (auth) automaticamente
const api = axios.create({
  baseURL,
  withCredentials: true,
});

// Anexa Bearer token (fallback para navegadores que bloqueiam cookies third-party)
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

if (import.meta?.env?.MODE !== 'production') {
  // Ajuda a diagnosticar baseURL em preview/local
  console.log('API baseURL =>', baseURL);
}

// Desloga automaticamente em 401/403 e limpa storage local
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem('loggedIn');
      sessionStorage.removeItem('loggedIn');
      localStorage.removeItem('user');
      sessionStorage.removeItem('user');
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.location.replace('/');
      }
    }
    return Promise.reject(error);
  },
);

export default api;
