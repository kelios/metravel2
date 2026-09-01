import { test, expect } from './fixtures';
import { gotoWithRetry, preacceptCookies } from './helpers/navigation';

const PRODUCTION_ORIGIN = 'https://metravel.by';

test.describe('@smoke Google auth', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login via Google callback authenticates user', async ({ page }) => {
    expect(
      process.env.E2E_SUITE,
      'Google Sign-In browser coverage is production-smoke-only',
    ).toBe('production-smoke');

    await preacceptCookies(page);

    await page.addInitScript(() => {
      type GoogleInitConfig = {
        client_id: string;
        callback: (response: { credential?: string }) => void;
      };

      const state: {
        initialized: boolean;
        rendered: boolean;
        promptCalls: number;
        clientId: string;
        callback: ((response: { credential?: string }) => void) | null;
      } = {
        initialized: false,
        rendered: false,
        promptCalls: 0,
        clientId: '',
        callback: null,
      };

      (window as unknown as Record<string, unknown>).__e2eGoogleState = state;

      (window as unknown as { google?: unknown }).google = {
        accounts: {
          id: {
            initialize: (config: GoogleInitConfig) => {
              state.initialized = true;
              state.clientId = String(config.client_id || '').trim();
              state.callback = config.callback;
            },
            renderButton: (parent: HTMLElement) => {
              state.rendered = true;
              const button = document.createElement('button');
              button.type = 'button';
              button.textContent = 'Войти через Google';
              button.setAttribute('aria-label', 'Войти через Google');
              button.addEventListener('click', () => {
                const cb = state.callback;
                state.promptCalls += 1;
                if (typeof cb === 'function') {
                  setTimeout(() => cb({ credential: 'e2e-google-credential' }), 0);
                }
              });
              parent.replaceChildren(button);
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
    let receivedGoogleLoginUrl = '';
    const unexpectedProductionMutations: string[] = [];

    // The production-smoke suite is read-only. Register this broad blocker first;
    // the endpoint-specific mocks below take precedence and handle the one expected POST.
    await page.route(`${PRODUCTION_ORIGIN}/api/**`, async (route) => {
      const request = route.request();
      const method = request.method().toUpperCase();
      if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        await route.fallback();
        return;
      }

      unexpectedProductionMutations.push(`${method} ${new URL(request.url()).pathname}`);
      await route.abort('blockedbyclient');
    });

    await page.route(`${PRODUCTION_ORIGIN}/api/user/google-login/**`, async (route) => {
      const method = route.request().method().toUpperCase();
      if (method !== 'POST') {
        await route.abort('blockedbyclient');
        expect(method, 'Google login API must only receive the mocked POST').toBe('POST');
        return;
      }

      receivedGoogleLoginUrl = route.request().url();
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
        headers: {
          'set-cookie': 'authToken=e2e-google-session; Path=/; HttpOnly; Secure; SameSite=Lax',
        },
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

    await page.route(`${PRODUCTION_ORIGIN}/api/user/*/profile/**`, async (route) => {
      const method = route.request().method().toUpperCase();
      if (method !== 'GET') {
        await route.abort('blockedbyclient');
        expect(method, 'Profile mock must remain read-only').toBe('GET');
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

    const productionOrigin = new URL(page.url()).origin;
    expect(productionOrigin, 'Google Sign-In browser coverage must run on production').toBe(
      PRODUCTION_ORIGIN,
    );

    await page.waitForFunction(() => {
      const state = (window as unknown as Record<string, unknown>).__e2eGoogleState as
        | { initialized?: boolean; rendered?: boolean; clientId?: string }
        | undefined;
      return Boolean(state?.initialized) && Boolean(state?.rendered) && Boolean(state?.clientId);
    });

    const initializedClientId = await page.evaluate(() => {
      const state = (window as unknown as Record<string, unknown>).__e2eGoogleState as
        | { clientId?: string }
        | undefined;
      return String(state?.clientId || '').trim();
    });
    expect(initializedClientId, 'Production must initialize Google Sign-In with a client ID').toBeTruthy();

    const googleButton = page.getByRole('button', { name: 'Войти через Google' }).first();
    await expect(googleButton).toBeVisible({ timeout: 15_000 });
    await expect(googleButton).toBeEnabled();

    await googleButton.click();

    await page.evaluate(() => {
      const win = window as unknown as {
        google?: {
          accounts?: {
            id?: {
              prompt?: () => void;
            };
          };
        };
      };

      const state = (window as unknown as Record<string, unknown>).__e2eGoogleState as
        | { promptCalls?: number }
        | undefined;

      if ((state?.promptCalls ?? 0) === 0) {
        win.google?.accounts?.id?.prompt?.();
      }
    });

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });

    expect(receivedGoogleToken).toBe('e2e-google-credential');
    expect(new URL(receivedGoogleLoginUrl).origin).toBe(productionOrigin);
    expect(new URL(receivedGoogleLoginUrl).hostname).toBe('metravel.by');
    expect(new URL(receivedGoogleLoginUrl).pathname).toBe('/api/user/google-login/');

    const authSnapshot = await page.evaluate(() => {
      return {
        secureUserToken: window.localStorage.getItem('secure_userToken'),
        secureRefreshToken: window.localStorage.getItem('secure_refreshToken'),
        userId: window.localStorage.getItem('userId'),
        userName: window.localStorage.getItem('userName'),
      };
    });

    const authCookie = (await page.context().cookies()).find((cookie) => cookie.name === 'authToken');
    expect(authCookie, 'Google login must establish the HttpOnly web session').toBeTruthy();
    expect(authCookie?.httpOnly).toBe(true);
    expect(authCookie?.secure).toBe(true);
    expect(authSnapshot.secureUserToken).toBeNull();
    expect(authSnapshot.secureRefreshToken).toBeNull();
    expect(authSnapshot.userId).toBe('42');
    expect(authSnapshot.userName).toContain('E2E');
    expect(unexpectedProductionMutations, 'Production smoke must not send backend mutations').toEqual([]);
  });
});
