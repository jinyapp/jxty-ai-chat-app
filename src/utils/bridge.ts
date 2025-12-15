type Bridge = {
  callHandler: (
    name: string,
    params: Record<string, unknown>,
    cb: (res: unknown) => void
  ) => void;
};

declare global {
  interface Window {
    setupWebViewJavascriptBridge?: (cb: (bridge: Bridge) => void) => void;
  }
}

function getBridge(): Promise<Bridge | null> {
  return new Promise((resolve) => {
    const fn = window.setupWebViewJavascriptBridge;
    if (typeof fn === 'function') {
      fn((bridge: Bridge) => resolve(bridge));
    } else {
      resolve(null);
    }
  });
}

async function call(name: string, params: Record<string, unknown>): Promise<unknown> {
  const bridge = await getBridge();
  if (!bridge) {
    return null;
  }
  return new Promise((resolve) => {
    bridge.callHandler(name, params || {}, (res: unknown) => {
      resolve(res);
    });
  });
}

export async function getIsClientState(): Promise<boolean> {
  const res = (await call('getIsClientState', {})) ?? (await call('getIsclientstate', {}));
  try {
    const obj = typeof res === 'string' ? JSON.parse(res) : (res as { state?: number } | null);
    return !!(obj && obj.state === 1);
  } catch {
    return false;
  }
}

export type UserInfo = { state: number; data?: { memberid?: string } };
export async function getUserInfo(): Promise<UserInfo> {
  const res = await call('getUserInfo', {});
  try {
    const obj = typeof res === 'string' ? JSON.parse(res) : (res as UserInfo);
    return obj || { state: 0 };
  } catch {
    return { state: 0 };
  }
}

export async function doUserLogin(): Promise<void> {
  await call('doUserLogin', {});
}

export async function doReLogin(): Promise<void> {
  await call('doReLogin', {});
}
