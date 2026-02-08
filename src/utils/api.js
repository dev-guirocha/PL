import axios from 'axios';

const envBase = import.meta?.env?.VITE_API_BASE_URL;
const isDev = import.meta?.env?.DEV;
const inferProdBase = () => {
  if (typeof window === 'undefined') return '/api';
  const { hostname } = window.location;
  if (hostname === 'pandaloterias.com' || hostname.endsWith('.pandaloterias.com')) {
    return 'https://api.pandaloterias.com/api';
  }
  // Em domínios de preview/homolog (ex.: Railway), usa mesma origem.
  return '/api';
};
const defaultBase = isDev ? '/api' : inferProdBase();
const baseCandidate = (envBase && String(envBase).trim()) || defaultBase;
const baseURL = baseCandidate.endsWith('/api') ? baseCandidate : `${baseCandidate.replace(/\/$/, '')}/api`;
const frontAuthDebug = import.meta?.env?.VITE_AUTH_DEBUG === 'true' || import.meta?.env?.AUTH_DEBUG === 'true';

let bearerToken = null;
let bearerEnabled = false;

export const setBearerToken = (token) => {
  bearerToken = token || null;
  if (!bearerToken) bearerEnabled = false;
};

export const setBearerEnabled = (enabled) => {
  bearerEnabled = Boolean(enabled);
};

export const getBearerToken = () => bearerToken;
export const isBearerEnabled = () => bearerEnabled;

// Axios pré-configurado para enviar cookies HttpOnly (auth) automaticamente
const api = axios.create({
  baseURL,
  withCredentials: true,
});

if (frontAuthDebug) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
  console.log('[AUTH_DEBUG][frontend] baseURL', baseURL, 'origin', origin, 'withCredentials', true);
} else if (import.meta?.env?.MODE !== 'production') {
  // Ajuda a diagnosticar baseURL em preview/local
  console.log('API baseURL =>', baseURL);
}

api.interceptors.request.use((config) => {
  const headers = config.headers || {};
  if (bearerEnabled && bearerToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }
  if (!headers['X-Client']) {
    headers['X-Client'] = 'web';
  }
  config.headers = headers;
  return config;
});

// Desloga automaticamente em 401/403 e limpa storage local
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const skipAuthRedirect = error?.config?.skipAuthRedirect === true;
    if ((status === 401 || status === 403) && !skipAuthRedirect) {
      bearerToken = null;
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
