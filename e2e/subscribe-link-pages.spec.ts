import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { gotoWithRetry, preacceptCookies } from './helpers/navigation';

// #2121: страницы сайта по ссылке из письма рассылки вместо голой страницы DRF.
// Мок только `/api/subscribe/**` (правило проекта: спеки с моком API — на `dist`,
// `E2E_NO_WEBSERVER=1`). Токены-фикстуры: `ok` — 200, `used` — 404, `down` — обрыв сети.

const STATES = ['confirmed', 'unsubscribed', 'invalid', 'error'] as const;

async function mockSubscribeApi(page: Page) {
  const requests: string[] = [];
  await page.route('**/api/subscribe/**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname);
    const [, , , action, token] = url.pathname.split('/');
    if (token === 'down') return route.abort('internetdisconnected');
    if (token === 'used') {
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":"Not found."}' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, status: action === 'confirm' ? 'confirmed' : 'unsubscribed' }),
    });
  });
  return requests;
}

async function openAndReadState(page: Page, path: string) {
  await gotoWithRetry(page, path);
  const result = page.locator(
    STATES.map((state) => `[data-testid="subscription-link-${state}"]`).join(', '),
  );
  await expect(result).toBeVisible({ timeout: 30_000 });
  return result.getAttribute('data-testid');
}

async function expectFitsViewport(page: Page) {
  const layout = await page.evaluate(() => {
    const root = document.documentElement;
    const buttons = [...document.querySelectorAll('[data-testid^="subscription-link-"] [role="button"]')].map(
      (el) => el.getBoundingClientRect(),
    );
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      buttons: buttons.map((r) => ({ left: r.left, right: r.right })),
    };
  });
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  expect(layout.buttons.length).toBeGreaterThan(0);
  for (const button of layout.buttons) {
    expect(button.left).toBeGreaterThanOrEqual(0);
    expect(button.right).toBeLessThanOrEqual(layout.clientWidth);
  }
}

for (const viewport of [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
]) {
  test.describe(`subscribe link pages @ ${viewport.width}`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await preacceptCookies(page);
    });

    test('token links: confirmed, unsubscribed, invalid, error — one request per token', async ({ page }) => {
      const requests = await mockSubscribeApi(page);

      expect(await openAndReadState(page, '/subscribe/confirm?token=ok')).toBe('subscription-link-confirmed');
      await expect(page.getByText('Подписка подтверждена')).toBeVisible();
      await expectFitsViewport(page);
      expect(requests).toEqual(['/api/subscribe/confirm/ok/']);

      requests.length = 0;
      expect(await openAndReadState(page, '/subscribe/unsubscribe?token=ok')).toBe('subscription-link-unsubscribed');
      await expectFitsViewport(page);
      expect(requests).toEqual(['/api/subscribe/unsubscribe/ok/']);

      requests.length = 0;
      expect(await openAndReadState(page, '/subscribe/confirm?token=used')).toBe('subscription-link-invalid');
      await expectFitsViewport(page);
      expect(requests).toEqual(['/api/subscribe/confirm/used/']);

      requests.length = 0;
      expect(await openAndReadState(page, '/subscribe/confirm?token=down')).toBe('subscription-link-error');
      await expect(page.getByText('Ссылка недействительна или уже использована')).toHaveCount(0);
      await expectFitsViewport(page);
      expect(requests).toEqual(['/api/subscribe/confirm/down/']);
    });

    test('?status= from the backend redirect renders without calling the API', async ({ page }) => {
      const requests = await mockSubscribeApi(page);

      expect(await openAndReadState(page, '/subscribe/confirm?status=confirmed')).toBe('subscription-link-confirmed');
      expect(await openAndReadState(page, '/subscribe/unsubscribe?status=unsubscribed')).toBe(
        'subscription-link-unsubscribed',
      );
      expect(await openAndReadState(page, '/subscribe/confirm?status=invalid')).toBe('subscription-link-invalid');
      await expectFitsViewport(page);
      expect(requests).toEqual([]);

      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    });
  });
}
