import axios from 'axios';
// 直接使用 import.meta.env.VITE_APP_API_BASE_URL
import { reAuth } from './auth';

const TOKEN_KEY = 'auth_token';

export function setToken(token) {
  if (typeof token === 'string' && token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

const service = axios.create({
  baseURL: (import.meta.env.VITE_APP_API_BASE_URL || ''),
  timeout: 15000,
});

function decodeJwtPart(part) {
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (padded.length % 4)) % 4;
    const base = padded + '='.repeat(padLen);
    const json = atob(base);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isTokenExpiring(token, skewSeconds = 60) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const payload = decodeJwtPart(parts[1]);
  const exp = payload && typeof payload.exp === 'number' ? payload.exp : 0;
  if (!exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return exp <= now + skewSeconds;
}

service.interceptors.request.use(
  async (config) => {
    let token = getToken();
    if (token && isTokenExpiring(token)) {
      await reAuth();
      token = getToken();
    }
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

service.interceptors.response.use(
  (response) => {
    const data = response.data;
    if (data && typeof data === 'object' && 'code' in data && data.code === 401) {
      return Promise.reject({ response: { status: 401 }, config: response.config });
    }
    return data;
  },
  async (error) => {
    const status = error?.response?.status;
    const original = error?.config || {};
    if (status === 401 && !original._retry) {
      original._retry = true;
      await reAuth();
      const token = getToken();
      original.headers = original.headers || {};
      if (token) original.headers.Authorization = `Bearer ${token}`;
      return axios.request(original);
    }
    return Promise.reject(error);
  }
);

export function get(url, params) {
  return service.get(url, { params });
}

export function post(url, data) {
  return service.post(url, data);
}

export default service;
