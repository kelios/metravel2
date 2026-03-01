import { test, expect } from './fixtures';
import { gotoWithRetry, preacceptCookies } from './helpers/navigation';

test.describe('@smoke Google auth', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login via Google callback authenticates user', async ({ page }) => {
    const googleClientId = String(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
    expect(googleClientId, 'EXPO_PUBLIC_GOOGLE_CLIENT_ID must be set for Google Sign-In e2e').toBeTruthy();

    await preacceptCookies(page);

    await page.addInitScript(() => {
      type GoogleInitConfig = {
        client_id: string;
        callback: (response: { credential?: string }) => void;
      };

      const state: {
        initialized: boolean;
        promptCalls: number;
        callback: ((response: { credential?: string }) => void) | null;
      } = {
        initialized: false,
        promptCalls: 0,
        callback: null,
      };

      (window as unknown as Record<string, unknown>).__e2eGoogleState = state;

      (window as unknown as { google?: unknown }).google = {
        accounts: {
          id: {
            initialize: (config: GoogleInitConfig) => {
              state.initialized = true;
              state.callback = config.callback;
            },
            prompt: () => {
              state.promptCalls += 1;
              const cb = state.callback;
              if (typeof cb === 'function') {
                setTimeout(() => cb({ credential: 'e2e-google-credential' }), 0);
              }
            },
          },
        },
      };
    });

    let receivedGoogleToken = '';

    await page.route('**/api/user/google-login/**', async (route) => {
      if (route.request().method().toUpperCase() !== 'POST') {
        await route.fallback();
        return;
      }

      let payload: { id_token?: unknown } = {};
      try {
        payload = (route.request().postDataJSON() as { id_token?: unknown }) || {};
      } catch {
        payload = {};
      }

      receivedGoogleToken = String(payload.id_token ?? '');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'e2e-auth-token',
          refresh: 'e2e-refresh-token',
          name: 'E2E Google User',
          email: 'e2e-google@example.com',
          id: 42,
          is_superuser: false,
        }),
      });
    });

    await page.route('**/api/user/*/profile/**', async (route) => {
      if (route.request().method().toUpperCase() !== 'GET') {
        await route.fallback();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 42,
          user: 42,
          first_name: 'E2E',
          last_name: 'Google',
          avatar: null,
        }),
      });
    });

    await gotoWithRetry(page, '/login');

    await page.waitForFunction(() => {
      const state = (window as unknown as Record<string, unknown>).__e2eGoogleState as
        | { initialized?: boolean }
        | undefined;
      return Boolean(state?.initialized);
    });

    const googleButton = page.getByRole('button', { name: 'Войти через Google' });
    await expect(googleButton).toBeVisible({ timeout: 15_000 });
    await expect(googleButton).toBeEnabled();

    await googleButton.click();

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });

    expect(receivedGoogleToken).toBe('e2e-google-credential');

    const authSnapshot = await page.evaluate(() => {
      return {
        secureUserToken: window.localStorage.getItem('secure_userToken'),
        userId: window.localStorage.getItem('userId'),
        userName: window.localStorage.getItem('userName'),
      };
    });

    expect(authSnapshot.secureUserToken).toBeTruthy();
    expect(authSnapshot.userId).toBe('42');
    expect(authSnapshot.userName).toContain('E2E');
  });
});
