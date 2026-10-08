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
  const fixtureUserId = async () => {
    const id = Number(await getUserId(page));
    return Number.isSafeInteger(id) && id > 0 ? id : 1;
  };
  // Match the pathname exactly: /me/verifications and other user subroutes
  // retain their own handlers. Query strings do not change endpoint identity.
  await page.route((url) => url.pathname === '/api/user/me/', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: await fixtureUserId(), terms_accepted_current: true }),
    });
  });
  await page.route((url) => url.pathname === '/api/user/blocked/', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  // Account-delivery status is a private read made by quest/travel forms.
  // Fake authentication owns this response; subscription mutations keep their handlers.
  await page.route((url) => url.pathname === '/api/subscribe/status/', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ subscribed: false, email: '' }),
    });
  });
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

  await page.route('**/api/user/*/profile/**', async (route) => {
    if (route.request().method() === 'GET') {
      const id = await fixtureUserId();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id,
          user: id,
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
  return webAuthTokenFromCookies(cookies, url) !== '';
}

/**
 * Токен веб-сессии из банка cookie для этого адреса; `''` — сессии нет.
 *
 * Тот же фильтр Playwright режет и запросы из Node: `APIRequestContext` не
 * отправляет Secure-cookie на `http://127.0.0.1`, хотя Chromium её отправляет.
 * Проба «сессия жива?» по банку контекста отвечала 401 на живом входе, и
 * global-setup шёл во второй, UI-вход поверх уже вошедшего приложения (#2173).
 * Значение cookie и есть токен сессии, поэтому Node-запрос несёт его заголовком
 * `Authorization: Token`: бэкенд принимает его без CSRF
 * (`metravel/common/authentication.py`, `CookieTokenAuthentication`).
 */
export function webAuthTokenFromCookies(cookies: readonly BrowserCookie[], url: string): string {
  const { hostname, pathname } = new URL(url);
  const sessionCookie = cookies.find((cookie) => {
    if (cookie.name !== WEB_AUTH_COOKIE_NAME || !cookie.value) return false;
    const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`;
    if (!`.${hostname}`.endsWith(cookieDomain)) return false;
    return (pathname || '/').startsWith(cookie.path || '/');
  });
  return sessionCookie?.value ?? '';
}

/**
 * Что пишет «Принять» листа повторного согласия: `acceptTerms(AUTH_TERMS_CONSENT.version)`
 * (`api/consent.ts`, `utils/actionConsent.ts`). Импортировать их сюда нельзя —
 * оба тянут React Native; совпадение держит
 * `__tests__/e2e-helpers/terms-acceptance.test.ts`.
 */
export const E2E_TERMS_ACCEPTANCE = Object.freeze({
  version: '1',
  consentTypes: Object.freeze(['terms', 'community_rules'] as const),
});

type TermsApiResponse = { ok(): boolean; status(): number; json(): Promise<unknown> };

/** `APIRequestContext` аккаунта с уже подставленным `Authorization: Token`. */
export type TermsApi = {
  get(path: string): Promise<TermsApiResponse>;
  post(path: string, options: { data: Record<string, string> }): Promise<TermsApiResponse>;
};

/**
 * `already` — версия принята; `accepted` — записали сейчас; `unsupported` —
 * бэкенд не отдаёт `terms_accepted_current` (лист тогда не показывается);
 * `refused` — версия не принята, а писать согласие нельзя (прод).
 */
export type TermsAcceptanceResult = 'already' | 'accepted' | 'unsupported' | 'refused';

async function readTermsAcceptedCurrent(api: TermsApi): Promise<unknown> {
  const me = await api.get('/api/user/me/');
  if (!me.ok()) throw new Error(`ensureCurrentTermsAccepted: /api/user/me/ ответил HTTP ${me.status()}`);
  return ((await me.json().catch(() => null)) as { terms_accepted_current?: unknown } | null)
    ?.terms_accepted_current;
}

/**
 * #2173: сессия, открытая прямым `POST /api/user/login/`, пропускает шаг
 * настоящего входа — запись согласия, отмеченного на форме
 * (`stores/authStore.ts`, сразу после `/user/login/`). Аккаунт без текущей
 * версии условий видит тогда лист повторного согласия (`TermsReacceptGate`) на
 * каждом экране, и лист перехватывает клики. Согласие хранится на аккаунте, а
 * не на сессии, поэтому global-setup приводит каждый e2e-аккаунт к принятой
 * версии один раз за прогон — теми же двумя записями, что «Принять» на листе.
 *
 * На проде согласие — юридическая запись человека: при `allowWrite: false`
 * помощник ничего не пишет и возвращает `refused`.
 */
export async function ensureCurrentTermsAccepted(
  api: TermsApi,
  opts: { allowWrite: boolean },
): Promise<TermsAcceptanceResult> {
  const acceptedCurrent = await readTermsAcceptedCurrent(api);
  if (typeof acceptedCurrent !== 'boolean') return 'unsupported';
  if (acceptedCurrent) return 'already';
  if (!opts.allowWrite) return 'refused';

  const { version, consentTypes } = E2E_TERMS_ACCEPTANCE;
  for (const consentType of consentTypes) {
    const response = await api.post('/api/user/consents/', { data: { consent_type: consentType, version } });
    if (!response.ok()) {
      throw new Error(`ensureCurrentTermsAccepted: запись согласия ${consentType} ответила HTTP ${response.status()}`);
    }
  }
  // Как и у листа, источник правды — `/user/me/`, а не ответ записи.
  if ((await readTermsAcceptedCurrent(api)) !== true) {
    throw new Error(
      `ensureCurrentTermsAccepted: после записи версии ${version} сервер всё ещё не видит согласия — ` +
        'версия приложения разошлась с текущей версией условий на бэкенде',
    );
  }
  return 'accepted';
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

/**
 * #2132: форма входа и регистрации блокирует все способы входа, пока не
 * отмечено согласие с условиями. UI-вход в e2e отмечает его тем же действием,
 * что и человек; на формах без гейта шаг ничего не делает.
 */
export async function acceptAuthTerms(page: Page): Promise<void> {
  const checkbox = page.getByTestId('auth-terms-gate-checkbox').first();
  if (!(await checkbox.isVisible().catch(() => false))) return;
  if ((await checkbox.getAttribute('aria-checked').catch(() => null)) === 'true') return;
  await checkbox.click();
}
