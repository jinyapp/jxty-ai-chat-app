export const API_BASE = (import.meta.env.VITE_APP_API_BASE_URL || '/')

export function getApiBaseUrl() {
  return API_BASE
}
