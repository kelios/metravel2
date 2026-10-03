import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { gotoWithRetry, preacceptCookies } from './helpers/navigation';

// #2124: форма «Пришлём этот квест на почту» шлёт в `page_url` canonical
// страницы квеста (тот же, что в <link rel="canonical">), а после `created`
// честно просит подтвердить почту. Мок — только POST /api/subscribe/ (правило
// проекта: спеки с моком API — на `dist`, `E2E_NO_WEBSERVER=1`); данные квеста
// приходят из бэкенда стенда. Квест задаётся E2E_QUEST_PATH (по умолчанию
// краковский квест локальной копии базы).

const QUEST_PATH = process.env.E2E_QUEST_PATH || '/quests/1/krakow-dragon';
const EMAIL_LABEL = 'Email для подписки на новые маршруты';
const SUBMIT_LABEL = 'Подписаться на рассылку новых маршрутов';

async function captureSubscribe(page: Page) {
  const bodies: Array<Record<string, unknown>> = [];
  await page.route('**/api/subscribe/', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    bodies.push(JSON.parse(route.request().postData() || '{}'));
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, status: 'created' }),
    });
  });
  return bodies;
}

test.describe('quest email subscribe @ 390', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('sends the quest canonical as page_url and asks to confirm the e-mail', async ({ page }) => {
    await preacceptCookies(page);
    const bodies = await captureSubscribe(page);

    await gotoWithRetry(page, `${QUEST_PATH}?utm_source=e2e`);
    const email = page.getByLabel(EMAIL_LABEL);
    await email.scrollIntoViewIfNeeded({ timeout: 60_000 });
    await expect(email).toBeVisible();

    const canonical = await page.locator('link[rel="canonical"]').first().getAttribute('href');
    expect(canonical).toMatch(/\/quests\/[^/?#]+\/[^/?#]+$/);

    await email.fill('qa-2124@example.com');
    await page.getByTestId('email-subscribe-consent').click();
    await page.getByLabel(SUBMIT_LABEL).click();

    await expect(page.getByText('Проверьте почту и подтвердите подписку, после этого пришлём этот квест.')).toBeVisible();
    await expect(page.getByText(/Готово! Письмо/)).toHaveCount(0);

    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toEqual(
      expect.objectContaining({ source: 'quest', page_url: canonical, consent: true }),
    );
    expect(String(bodies[0].page_url)).not.toContain('utm_source');

    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  });
});
