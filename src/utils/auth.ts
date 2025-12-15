// 直接使用 import.meta.env.VITE_APP_API_BASE_URL
import { setToken, getToken, clearToken } from './request';
import { getIsClientState, getUserInfo, doUserLogin, doReLogin, UserInfo } from './bridge';

const ENV_USER = (import.meta.env.VITE_APP_AUTH_USERNAME || '') as string;
const ENV_PASS = (import.meta.env.VITE_APP_AUTH_PASSWORD || '') as string;
const STATIC_TOKEN = (import.meta.env.VITE_APP_STATIC_TOKEN || '') as string;
const FALLBACK_USER = { username: ENV_USER, password: ENV_PASS };

const FIXED = { tenantId: '74', code: '83', uuid: '9c7ee589-d00c-422d-895f-e0470405421c' };

interface LoginResponse { data?: { access_token?: string; token?: string } }
async function loginBackend(username: string, password: string): Promise<string> {
  const payload = { ...FIXED, username, password };
  const base = (import.meta.env.VITE_APP_API_BASE_URL || '').replace(/\/+$/, '');
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('login_failed');
  const data: LoginResponse & { data?: { token_type?: string; authorization?: string } } = await res.json();
  const headerAuth = res.headers.get('authorization') || res.headers.get('Authorization') || '';
  function normalizeToken(input?: string): string {
    const raw = (input || '').trim();
    if (!raw) return '';
    if (/^bearer\s+/i.test(raw)) return raw.replace(/^bearer\s+/i, '').trim();
    return raw;
  }
  let token = normalizeToken(headerAuth);
  if (!token) {
    const d: Record<string, unknown> = (data?.data as Record<string, unknown> | undefined) || (data as unknown as Record<string, unknown>);
    const raw = typeof d?.authorization === 'string' ? d.authorization
      : typeof d?.access_token === 'string' ? d.access_token
      : typeof d?.token === 'string' ? d.token
      : '';
    const type = typeof d?.token_type === 'string' ? d.token_type : '';
    token = normalizeToken(type ? `${type} ${raw}` : raw);
  }
  if (token) setToken(token);
  return token;
}

function decodeJwtPart(part: string): unknown {
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

function getTokenExp(token: string): number {
  const parts = (token || '').split('.');
  if (parts.length !== 3) return 0;
  const payload = decodeJwtPart(parts[1]) as { exp?: number } | null;
  const exp = payload && typeof payload.exp === 'number' ? payload.exp : 0;
  return exp || 0;
}

function isTokenExpiring(token: string, skewSeconds = 60): boolean {
  const exp = getTokenExp(token);
  if (!exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return exp <= now + skewSeconds;
}

export async function ensureAuth(): Promise<string> {
  const existing = getToken();
  if (existing && !isTokenExpiring(existing)) return existing;
  if (existing && isTokenExpiring(existing)) {
    const refreshed = await reAuth();
    if (refreshed) return refreshed;
  }
  if (STATIC_TOKEN) { setToken(STATIC_TOKEN); return STATIC_TOKEN; }
  const inApp = await getIsClientState();
  if (inApp) {
    const info: UserInfo = await getUserInfo();
    if (info?.state === 1 && info?.data?.memberid) {
      const token = await loginBackend(info.data.memberid, 'aNr_C8an93TbcUj');
      return token;
    }
    await doUserLogin();
    const info2: UserInfo = await getUserInfo();
    if (info2?.state === 1 && info2?.data?.memberid) {
      const token = await loginBackend(info2.data.memberid, 'aNr_C8an93TbcUj');
      return token;
    }
  }
  const token = await loginBackend(ENV_USER || FALLBACK_USER.username, ENV_PASS || FALLBACK_USER.password);
  return token;
}

export async function reAuth(): Promise<string> {
  clearToken();
  if (STATIC_TOKEN) { setToken(STATIC_TOKEN); return STATIC_TOKEN; }
  const inApp = await getIsClientState();
  if (inApp) {
    await doReLogin();
    const info: UserInfo = await getUserInfo();
    if (info?.state === 1 && info?.data?.memberid) {
      const token = await loginBackend(info.data.memberid, 'aNr_C8an93TbcUj');
      return token;
    }
  }
  const token = await loginBackend(ENV_USER || FALLBACK_USER.username, ENV_PASS || FALLBACK_USER.password);
  return token;
}

function toRecordHeaders(h?: HeadersInit): Record<string, string> {
  if (!h) return {};
  if (h instanceof Headers) {
    const obj: Record<string, string> = {};
    h.forEach((v, k) => { obj[k] = v; });
    return obj;
  }
  if (Array.isArray(h)) {
    const obj: Record<string, string> = {};
    h.forEach(([k, v]) => { obj[k] = v; });
    return obj;
  }
  return h as Record<string, string>;
}

export async function authFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const token = await ensureAuth();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...toRecordHeaders(init?.headers) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch(input, { ...init, headers });
  if (resp.status === 401) {
    const newToken = await reAuth();
    const headers2: Record<string, string> = { 'Content-Type': 'application/json', ...toRecordHeaders(init?.headers) };
    if (newToken) headers2.Authorization = `Bearer ${newToken}`;
    return fetch(input, { ...init, headers: headers2 });
  }
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try {
      const data = await resp.clone().json();
      const code = (data && typeof data === 'object' && ('code' in data)) ? (data as { code: number | string }).code : undefined;
      const isUnauthorized = code === 401 || code === '401';
      if (isUnauthorized) {
        const newToken = await reAuth();
        const headers3: Record<string, string> = { 'Content-Type': 'application/json', ...toRecordHeaders(init?.headers) };
        if (newToken) headers3.Authorization = `Bearer ${newToken}`;
        return fetch(input, { ...init, headers: headers3 });
      }
    } catch {
      // ignore json parse errors
    }
  }
  return resp;
}
