import axios from 'axios';

// Axios pré-configurado para enviar cookies HttpOnly (auth) automaticamente
const api = axios.create({
  baseURL: import.meta?.env?.VITE_API_BASE_URL || '/api',
  withCredentials: true,
});

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
