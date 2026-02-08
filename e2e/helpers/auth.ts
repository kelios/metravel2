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
  return Buffer.from(result, 'binary').toString('base64');
}

/**
 * Seeds fake auth tokens into localStorage via addInitScript.
 * Useful when E2E_EMAIL/E2E_PASSWORD are not available.
 */
export async function ensureAuthedStorageFallback(page: Page): Promise<void> {
  const encrypted = simpleEncrypt('e2e-fake-token', 'metravel_encryption_key_v1');
  await page.addInitScript((payload: { encrypted: string }) => {
    try {
      window.localStorage.setItem('secure_userToken', payload.encrypted);
      window.localStorage.setItem('userId', '1');
      window.localStorage.setItem('userName', 'E2E User');
      window.localStorage.setItem('isSuperuser', 'false');
    } catch {
      // ignore
    }
  }, { encrypted });
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
