/**
 * Хелперы для авторизации в E2E тестах
 */

import { Page } from '@playwright/test';

/**
 * Проверяет, авторизован ли пользователь
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    const hasToken = await page.evaluate(() => {
      try {
        const token = window.localStorage.getItem('secure_userToken');
        return typeof token === 'string' && token.length > 0;
      } catch {
        return false;
      }
    });
    return hasToken;
  } catch {
    return false;
  }
}

/**
 * Получает userId текущего пользователя
 */
export async function getUserId(page: Page): Promise<string | null> {
  try {
    return await page.evaluate(() => {
      try {
        return window.localStorage.getItem('userId');
      } catch {
        return null;
      }
    });
  } catch {
    return null;
  }
}

/**
 * Проверяет, является ли текущий пользователь суперпользователем
 */
export async function isSuperuser(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      try {
        return window.localStorage.getItem('isSuperuser') === 'true';
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * Получает данные текущего пользователя
 */
export async function getCurrentUser(page: Page): Promise<{
  isAuthenticated: boolean;
  userId: string | null;
  userName: string | null;
  isSuperuser: boolean;
}> {
  try {
    return await page.evaluate(() => {
      try {
        const token = window.localStorage.getItem('secure_userToken');
        const userId = window.localStorage.getItem('userId');
        const userName = window.localStorage.getItem('userName');
        const isSuperuser = window.localStorage.getItem('isSuperuser') === 'true';

        return {
          isAuthenticated: typeof token === 'string' && token.length > 0,
          userId,
          userName,
          isSuperuser,
        };
      } catch {
        return {
          isAuthenticated: false,
          userId: null,
          userName: null,
          isSuperuser: false,
        };
      }
    });
  } catch {
    return {
      isAuthenticated: false,
      userId: null,
      userName: null,
      isSuperuser: false,
    };
  }
}

/**
 * Simple XOR encrypt used for seeding fake auth tokens in localStorage.
 */
export function simpleEncrypt(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return `enc1:${Buffer.from(result, 'binary').toString('base64')}`;
}

/**
 * Seeds fake auth tokens into localStorage via addInitScript.
 * Useful when E2E_EMAIL/E2E_PASSWORD are not available.
 */
export async function ensureAuthedStorageFallback(page: Page): Promise<void> {
  const encrypted = simpleEncrypt('e2e-fake-token', 'metravel_encryption_key_v1');
  const encryptedRefresh = simpleEncrypt('e2e-fake-refresh-token', 'metravel_encryption_key_v1');
  await page.addInitScript((payload: { encrypted: string; encryptedRefresh: string }) => {
    try {
      const existingToken = window.localStorage.getItem('secure_userToken');
      if (typeof existingToken === 'string' && existingToken.length > 0) {
        return;
      }

      window.localStorage.setItem('secure_userToken', payload.encrypted);
      window.localStorage.setItem('secure_refreshToken', payload.encryptedRefresh);

      if (!window.localStorage.getItem('userId')) {
        window.localStorage.setItem('userId', '1');
      }
      if (!window.localStorage.getItem('userName')) {
        window.localStorage.setItem('userName', 'E2E User');
      }
      if (!window.localStorage.getItem('isSuperuser')) {
        window.localStorage.setItem('isSuperuser', 'false');
      }
    } catch {
      // ignore
    }
  }, { encrypted, encryptedRefresh });
}

/**
 * Mocks API endpoints that are called during auth hydration (e.g. fetchUserProfile)
 * to prevent 401 responses from invalidating the fake auth state.
 * Call this BEFORE navigating to any page that requires auth.
 */
export async function mockFakeAuthApis(page: Page): Promise<void> {
  await page.route('**/api/user/*/profile/**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          user: 1,
          first_name: 'E2E',
          last_name: 'User',
          avatar: null,
        }),
      });
    }
    return route.continue();
  });

  // Mock token refresh to prevent 401 cascade
  await page.route('**/api/user/refresh/**', (route) => {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access: 'fake-access' }) });
  });
}

export async function waitForAuth(page: Page, timeoutMs = 5000): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => {
        try {
          const token = window.localStorage.getItem('secure_userToken');
          return typeof token === 'string' && token.length > 0;
        } catch {
          return false;
        }
      },
      { timeout: timeoutMs }
    );
    return true;
  } catch {
    return false;
  }
}
