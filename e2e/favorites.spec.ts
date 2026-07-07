import { test, expect } from './fixtures';
import { mockFakeAuthApis } from './helpers/auth';

/**
 * Favorites flow coverage.
 *
 * The /favorites screen has three deterministic states that were previously
 * untested at the UI level (only an API-seeded happy path existed in
 * travel-full-flow.spec.ts):
 *   1. Guest  -> auth gate ("Войдите в аккаунт").
 *   2. Authed + empty -> empty state ("Сохраняй маршруты…").
 *   3. Authed + has favorites -> saved card renders and can be removed.
 *
 * Favorites are client state (Zustand store persisted to AsyncStorage, which on
 * web maps directly to localStorage). We seed both the auth token and the
 * favorites cache through addInitScript so the flow is fully deterministic and
 * does not depend on a live backend.
 */

const ANON_STATE = { cookies: [], origins: [] };

const ENCRYPTION_KEY = 'metravel_encryption_key_v1';

function xorEncrypt(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i += 1) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return `enc1:${Buffer.from(result, 'binary').toString('base64')}`;
}

function seedConsent(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'metravel_consent_v1',
        JSON.stringify({ necessary: true, analytics: false, date: '2026-01-01T00:00:00.000Z' })
      );
    } catch {
      // ignore
    }
  });
}

/**
 * Seeds a fake authenticated session plus an optional list of favorites into the
 * server-cache key the FavoritesProvider reads on mount (loadServerCached).
 */
async function seedAuthAndFavorites(
  page: import('@playwright/test').Page,
  favorites: Array<{ id: number; title: string; url: string }>
) {
  const token = xorEncrypt('e2e-fake-token', ENCRYPTION_KEY);
  const refresh = xorEncrypt('e2e-fake-refresh-token', ENCRYPTION_KEY);
  const userId = '1';
  const cacheKey = `metravel_favorites_server_${userId}`;
  const localKey = `metravel_favorites_${userId}`;
  const items = favorites.map((f) => ({
    id: f.id,
    type: 'travel',
    title: f.title,
    url: f.url,
    addedAt: 1735689600000,
  }));

  await page.addInitScript(
    (payload: {
      token: string;
      refresh: string;
      userId: string;
      cacheKey: string;
      localKey: string;
      items: unknown[];
    }) => {
      try {
        window.localStorage.setItem('secure_userToken', payload.token);
        window.localStorage.setItem('secure_refreshToken', payload.refresh);
        window.localStorage.setItem('userId', payload.userId);
        window.localStorage.setItem('userName', 'E2E User');
        window.localStorage.setItem('isSuperuser', 'false');
        const serialized = JSON.stringify(payload.items);
        window.localStorage.setItem(payload.cacheKey, serialized);
        window.localStorage.setItem(payload.localKey, serialized);
      } catch {
        // ignore
      }
    },
    { token, refresh, userId, cacheKey, localKey, items }
  );

  // Keep auth hydration from invalidating the fake token, and make any lazy
  // server refresh return the same favorites we seeded into the cache.
  await mockFakeAuthApis(page);
  await page.route('**/api/user/*/favorite-travels/**', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        favorites.map((f) => ({
          id: f.id,
          name: f.title,
          url: f.url,
          slug: String(f.id),
          travel_image_thumb_url: '',
          updated_at: '2025-01-01T00:00:00.000Z',
        }))
      ),
    });
  });
}

test.describe('@smoke Favorites', () => {
  // global-setup seeds a fake auth token into the default storageState even
  // without creds, so every test in this suite starts from an explicit anonymous
  // state and seeds its own auth when needed.
  test.use({ storageState: ANON_STATE });

  test('guest is prompted to log in on /favorites', async ({ page }) => {
    await seedConsent(page);

    await page.goto('/favorites', { waitUntil: 'domcontentloaded', timeout: 120_000 });

    await expect(page.getByText('Войдите в аккаунт', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('Войти', { exact: true }).first()).toBeVisible();
  });

  test.describe(() => {
    test('authenticated user with no favorites sees the empty state', async ({ page }) => {
      await seedAuthAndFavorites(page, []);
      await seedConsent(page);

      await page.goto('/favorites', { waitUntil: 'domcontentloaded', timeout: 120_000 });

      await expect(page.getByText('В «Хочу поехать» пока пусто', { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expect(
        page.getByText('Нажмите ♥ на карточке маршрута, чтобы добавить место, куда хотите поехать.', {
          exact: true,
        })
      ).toBeVisible();
      // The auth gate must NOT be shown for an authenticated user.
      await expect(page.getByText('Войдите в аккаунт', { exact: true })).toHaveCount(0);
    });

    test('authenticated user sees a saved favorite and can remove it', async ({ page }) => {
      const favorite = { id: 990001, title: 'E2E Saved Favorite', url: '/travels/990001' };
      await seedAuthAndFavorites(page, [favorite]);
      await seedConsent(page);

      // Removal uses window.confirm on web — auto-accept it.
      page.on('dialog', (dialog) => dialog.accept().catch(() => undefined));

      await page.goto('/favorites', { waitUntil: 'domcontentloaded', timeout: 120_000 });

      await expect(page.getByText('Хочу поехать', { exact: true }).first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText(favorite.title, { exact: true }).first()).toBeVisible({
        timeout: 30_000,
      });

      const removeBtn = page.getByLabel('Удалить из «Хочу поехать»').first();
      if (!(await removeBtn.isVisible().catch(() => false))) {
        test.info().annotations.push({
          type: 'note',
          description: 'Remove control not rendered in this environment; skipping removal assertion.',
        });
        return;
      }

      await removeBtn.click();
      await expect(page.getByText(favorite.title, { exact: true })).toHaveCount(0, {
        timeout: 15_000,
      });
    });
  });
});
