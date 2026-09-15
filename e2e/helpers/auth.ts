/**
 * Хелперы для авторизации в E2E тестах
 */

import type { Page } from '@playwright/test';

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

/**
 * Имя HttpOnly-cookie веб-сессии. Бэкенд ставит её на логине с этими же
 * атрибутами: `metravel/common/authentication.py:88-102` и
 * `AUTH_TOKEN_COOKIE_*` в `metravel/envs/common/settings.py:123-128`.
 */
export const WEB_AUTH_COOKIE_NAME = 'authToken';

type BrowserCookie = { name: string; value: string; domain: string; path: string };

/**
 * Несёт ли банк cookie веб-сессию для этого адреса.
 *
 * Сопоставление host/path здесь своё, потому что `context.cookies(url)`
 * ВЫБРАСЫВАЕТ Secure-cookie, если URL не `https:`, а host не `localhost`
 * (playwright-core 1.61.1, `lib/coreBundle.js:12641` → `isLocalHostname`).
 * Дефолтный e2e-таргет — `http://127.0.0.1:8085`, а бэкенд ставит cookie
 * `Secure`, поэтому фильтр Playwright отвечает «сессии нет» на контексте, где
 * она есть: реальный вход из global-setup молча подменялся бы сидом, а при
 * чужом токене — чужой сессией.
 */
export function hasWebAuthCookie(cookies: readonly BrowserCookie[], url: string): boolean {
  const { hostname, pathname } = new URL(url);
  return cookies.some((cookie) => {
    if (cookie.name !== WEB_AUTH_COOKIE_NAME || !cookie.value) return false;
    const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`;
    if (!`.${hostname}`.endsWith(cookieDomain)) return false;
    return (pathname || '/').startsWith(cookie.path || '/');
  });
}

/**
 * Гарантирует, что контекст несёт веб-сессию так же, как настоящий вход.
 *
 * На web токен в JS не хранится вовсе (`shouldUseStoredAuthToken()` →
 * `utils/authPlatform.ts:22`, на web `authStore` стирает `secure_userToken`),
 * поэтому запись токена в `localStorage` авторизацией не является: жёсткая
 * загрузка документа уходит на сервер анонимной. Документные маршруты,
 * которые резолвятся по зрителю (`/travel/<id>` после #1932), видят только эту
 * cookie.
 *
 * Обычно она уже лежит в storageState от global-setup — тогда переиспользуем
 * реальную сессию и ничего не подменяем. Cookie добавляется только если её нет,
 * и тогда обязателен `userId`: см. ниже, одной cookie для сессии не хватает.
 */
export async function ensureWebAuthCookie(
  page: Page,
  opts: { url: string; token: string; userId?: string | null },
): Promise<void> {
  const context = page.context();
  // Без фильтра по URL: см. `hasWebAuthCookie` — фильтр Playwright прячет
  // Secure-cookie реальной сессии на http-таргете `127.0.0.1`.
  if (hasWebAuthCookie(await context.cookies(), opts.url)) return;

  const token = String(opts.token || '').trim();
  if (!token) {
    throw new Error('ensureWebAuthCookie: no auth token to seed the web session cookie with');
  }

  // Витрина `userId` — часть веб-сессии, а не украшение: `checkAuthentication`
  // схлопывает пользователя в гостя на `!storageData.userId` ДО обращения к
  // cookie-пробе (`stores/authStore.ts:316`). Cookie без неё даёт страницу
  // гостя при живой серверной сессии — ровно тот тихий no-op, против которого
  // этот хелпер и написан, поэтому требуем её громко.
  const userId = String(opts.userId ?? '').trim();
  if (!userId) {
    throw new Error(
      'ensureWebAuthCookie: seeding a web session requires userId — authStore checks it before the cookie probe',
    );
  }

  await context.addCookies([
    {
      name: WEB_AUTH_COOKIE_NAME,
      value: token,
      domain: new URL(opts.url).hostname,
      path: '/',
      httpOnly: true,
      // Бэкенд ставит cookie Secure и на локальном стенде: http://127.0.0.1 —
      // trustworthy origin, браузер такую cookie принимает и отправляет.
      secure: true,
      sameSite: 'Lax',
    },
  ]);

  await page.addInitScript((value: string) => {
    try {
      // Токен сюда класть нельзя: на web клиент его не читает и стирает сам.
      window.localStorage.setItem('userId', value);
    } catch {
      // ignore
    }
  }, userId);
}
