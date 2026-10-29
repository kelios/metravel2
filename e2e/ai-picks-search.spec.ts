import type { Locator } from '@playwright/test';
import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

/**
 * #2459: строка «Подобрать по описанию» на /search. Служба metravel-assist мокается
 * целиком (`/ai/search`), обычный каталог остаётся живым; бандл собран с
 * `EXPO_PUBLIC_AI_PICKS=1` (.env.e2e), иначе панели нет и тест пропускается явно.
 */
const PANEL_TIMEOUT_MS = 30_000;

/** Панель живёт в lazy-чанке каталога: ждём её появления, а не проверяем мгновенно. */
const waitForPanel = (panel: Locator): Promise<boolean> =>
  panel.waitFor({ state: 'visible', timeout: PANEL_TIMEOUT_MS }).then(() => true).catch(() => false);

const aiItems = [
  {
    type: 'travel',
    source_id: 816,
    title: 'Ойцув и Пескова Скала с детьми',
    url: 'https://metravel.by/travels/ojcow-e2e',
    snippet: 'Замок на скале, пещеры и короткие тропы — хватит одного дня.',
    score: 0.81,
    city: 'Kraków',
    country: 'Польша',
    lat: null,
    lng: null,
    cover: null,
  },
  {
    type: 'quest',
    source_id: 7,
    title: 'Квест по Кракову для семьи',
    url: 'https://metravel.by/quests/krakow/krakow-family',
    snippet: 'Загадки Рынка и Вавеля на два часа прогулки.',
    score: 0.77,
    city: 'Kraków',
    country: 'Польша',
    lat: null,
    lng: null,
    cover: null,
  },
];

test.describe('AI picks on /search (#2459)', () => {
  test('describes a trip and gets semantic cards with snippets; clearing returns to idle', async ({ page }) => {
    await preacceptCookies(page);
    const aiRequests: string[] = [];
    await page.route('**/ai/search', async (route) => {
      const body = route.request().postDataJSON() as { q?: string };
      aiRequests.push(body?.q ?? '');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: aiItems, took_ms: 42, index_built_at: '2026-10-25T00:00:00Z', degraded: false, cached: false }),
      });
    });

    await page.goto('/search', { waitUntil: 'domcontentloaded' });

    const panel = page.getByTestId('ai-search-panel');
    test.skip(!(await waitForPanel(panel)), 'бандл собран без EXPO_PUBLIC_AI_PICKS');

    const input = page.getByTestId('ai-search-input');
    await expect(input).toBeVisible({ timeout: PANEL_TIMEOUT_MS });

    await input.fill('с детьми на выходные под Краковом');
    await expect(page.getByTestId('ai-search-results')).toBeVisible({ timeout: PANEL_TIMEOUT_MS });
    await expect(page.getByText('Ойцув и Пескова Скала с детьми')).toBeVisible();
    await expect(page.getByText('Квест по Кракову для семьи')).toBeVisible();
    await expect(page.getByTestId('ai-pick-card-snippet').first()).toBeVisible();
    expect(aiRequests).toEqual(['с детьми на выходные под Краковом']);
    // Каталог под панелью не схлопнулся: панель живёт в прокручиваемом заголовке списка.
    await expect(page.getByTestId('cards-scroll-container')).toBeVisible();
    expect((await page.getByTestId('cards-scroll-container').boundingBox())?.height ?? 0).toBeGreaterThan(0);

    await page.getByTestId('ai-search-clear').click();
    await expect(page.getByTestId('ai-search-results')).toHaveCount(0);
    await expect(input).toHaveValue('');
    // Очистка не должна порождать запрос с пустым q. Вместо сна на debounce ждём
    // событие: новый ввод даёт ровно один новый запрос, а между ними ничего не было.
    await input.fill('замки беларуси');
    await expect(page.getByTestId('ai-search-results')).toBeVisible({ timeout: PANEL_TIMEOUT_MS });
    expect(aiRequests).toEqual(['с детьми на выходные под Краковом', 'замки беларуси']);
  });

  test('keeps the input with an unavailable note when the service fails, catalog still works', async ({ page }) => {
    await preacceptCookies(page);
    await page.route('**/ai/search', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'busy' }) }));
    await page.goto('/search', { waitUntil: 'domcontentloaded' });

    const panel = page.getByTestId('ai-search-panel');
    test.skip(!(await waitForPanel(panel)), 'бандл собран без EXPO_PUBLIC_AI_PICKS');

    await page.getByTestId('ai-search-input').fill('замки беларуси');
    await expect(page.getByTestId('ai-search-unavailable')).toBeVisible({ timeout: PANEL_TIMEOUT_MS });
    await expect(page.getByTestId('ai-search-input')).toBeVisible();
    await expect(page.getByTestId('ai-search-results')).toHaveCount(0);
    await expect(page.getByRole('searchbox', { name: /^Поиск маршрутов(?:\.|$)/ })).toBeVisible();
  });
});
