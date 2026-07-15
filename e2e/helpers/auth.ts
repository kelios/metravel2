/**
 * Хелперы для авторизации в E2E тестах
 */

import { Page } from '@playwright/test';

/**
 * Проверяет, авторизован ли пользователь
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    const hasUserMetadata = await page.evaluate(() => {
      try {
        const userId = window.localStorage.getItem('userId');
        return typeof userId === 'string' && userId.length > 0;
      } catch {
        return false;
      }
    });
    return hasUserMetadata;
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
        const userId = window.localStorage.getItem('userId');
        const userName = window.localStorage.getItem('userName');
        const isSuperuser = window.localStorage.getItem('isSuperuser') === 'true';

        return {
          isAuthenticated: typeof userId === 'string' && userId.length > 0,
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
 * Kept for native-credential fixtures and request payload compatibility. Web
 * auth helpers below must not persist this value in browser storage.
 */
export function simpleEncrypt(text: string, key: string): string {
  let result = '';
  for (let index = 0; index < text.length; index += 1) {
    result += String.fromCharCode(text.charCodeAt(index) ^ key.charCodeAt(index % key.length));
  }
  return `enc1:${Buffer.from(result, 'binary').toString('base64')}`;
}

type FakeAuthOptions = {
  isSuperuser?: boolean;
  userId?: string;
  userName?: string;
};

/**
 * Seeds non-secret user metadata via addInitScript. Pair with
 * mockFakeAuthApis() so the cookie-session probe succeeds without a real login.
 */
export async function ensureAuthedStorageFallback(
  page: Page,
  options: FakeAuthOptions = {},
): Promise<void> {
  const payload = {
    userId: options.userId ?? '1',
    userName: options.userName ?? 'E2E User',
    isSuperuser: options.isSuperuser === true ? 'true' : 'false',
  };
  await page.addInitScript((metadata: typeof payload) => {
    try {
      window.localStorage.removeItem('secure_userToken');
      window.localStorage.removeItem('secure_refreshToken');
      window.localStorage.setItem('userId', metadata.userId);
      window.localStorage.setItem('userName', metadata.userName);
      window.localStorage.setItem('isSuperuser', metadata.isSuperuser);
    } catch {
      // ignore
    }
  }, payload);
}

/**
 * Mocks API endpoints that are called during auth hydration (e.g. fetchUserProfile)
 * to prevent 401 responses from invalidating the fake auth state.
 * Call this BEFORE navigating to any page that requires auth.
 */
export async function mockFakeAuthApis(page: Page): Promise<void> {
  await page.route('**/api/user/me/verifications/**', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    }
    return route.continue();
  });

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
          const userId = window.localStorage.getItem('userId');
          return typeof userId === 'string' && userId.length > 0;
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
