// src/utils/env.ts
export function getApiBaseUrl() {
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname.startsWith('192.168.') || hostname === '127.0.0.1') {
      return 'http://localhost:6039/';
    }
    if (hostname.includes('ai-test.tyfmc.cn')) {
      return 'https://ai-test.tyfmc.cn/';
    }
    if (hostname.includes('ai.tyfmc.cn')) {
      return 'https://ai.tyfmc.cn/';
    }
    // 默认返回dev
    return 'https://ai-test.tyfmc.cn/';
  }