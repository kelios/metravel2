import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

const mobilePanelEntrySelector = [
  '[data-testid="map-open-list"]',
  '[testID="map-open-list"]',
  '[data-testid="map-peek-expand"]',
  '[testID="map-peek-expand"]',
  '[data-testid="map-panel-close"]',
  '[testID="map-panel-close"]',
].join(', ');

const maybeRecoverFromWorkletError = async (page: any) => {
  const errorTitle = page.getByText('Что-то пошло не так', { exact: true });
  const workletError = page.getByText('_WORKLET is not defined', { exact: true });

  const hasError =
    (await errorTitle.isVisible().catch(() => false)) &&
    (await workletError.isVisible().catch(() => false));

  if (!hasError) return;

  const reloadButton = page.getByText('Перезагрузить страницу', { exact: true });
  const retryButton = page.getByText('Попробовать снова', { exact: true });

  if (await reloadButton.isVisible().catch(() => false)) {
    await reloadButton.click({ force: true }).catch(() => null);
    return;
  }
  if (await retryButton.isVisible().catch(() => false)) {
    await retryButton.click({ force: true }).catch(() => null);
    return;
  }

  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
};

const mapTravelsTabSelector = '[data-testid="map-travels-tab"], [testID="map-travels-tab"]';
const mapTravelCardSelector = '[data-testid="map-travel-card"], [testID="map-travel-card"]';
const mockedPoints = [
  {
    id: 30_001,
    coord: '53.900600,27.559000',
    address: 'Очень длинное название места без изображения для проверки ограничения строк',
    travelImageThumbUrl: '',
    categoryName: 'Город',
    articleUrl: '',
    urlTravel: '/travels/e2e-no-image-one',
  },
  {
    id: 30_002,
    coord: '53.910600,27.569000',
    address: 'Второе место без изображения',
    travelImageThumbUrl: '',
    categoryName: 'Город',
    articleUrl: '',
    urlTravel: '/travels/e2e-no-image-two',
  },
];

const gotoMapWithRecovery = async (page: any) => {
  const mapReady = page.getByTestId('map-leaflet-wrapper');
  const mobileMenu = page.locator(mobilePanelEntrySelector).first();
  const workletError = page.getByText('_WORKLET is not defined', { exact: true });
  const notFound = page.getByText('Not found', { exact: true });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const path = attempt === 0 ? '/map' : `/map?e2eCardRetry=${attempt}`;
    await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await Promise.race([
      mapReady.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null),
      mobileMenu.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null),
      workletError.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null),
      notFound.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null),
    ]);

    const hasUi =
      (await mapReady.isVisible().catch(() => false)) ||
      (await mobileMenu.isVisible().catch(() => false));
    if (hasUi) return;

    const hasWorkletError = await workletError.isVisible().catch(() => false);
    if (hasWorkletError) {
      await maybeRecoverFromWorkletError(page);
      await page.waitForTimeout(800).catch(() => null);
      continue;
    }
  }

  throw new Error(`Map UI did not appear after route retries (url=${page.url()})`);
};

test.describe('Map Travel Card - UnifiedTravelCard', () => {
  test.beforeEach(async ({ page }) => {
    await preacceptCookies(page);

    await page.route('**/api/filterformap/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          countries: [],
          categories: [],
          categoryTravelAddress: [],
          companions: [],
          complexity: [],
          month: [],
          over_nights_stay: [],
          transports: [],
          year: '',
        }),
      }),
    );
    await page.route('**/api/travels/search_travels_for_map/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockedPoints) }),
    );

    await gotoMapWithRecovery(page);
  });

  const openTravelCards = async (page: any) => {
    const mobileMenu = page.locator(mobilePanelEntrySelector).first();
    if (await mobileMenu.isVisible().catch(() => false)) {
      await mobileMenu.click();
    }

    await expect(page.getByTestId('filters-panel')).toBeVisible({ timeout: 60_000 });

    const travelsTab = page.getByTestId('map-panel-tab-travels');
    await expect(travelsTab).toBeVisible({ timeout: 30_000 });
    await travelsTab.click();
    await expect(page.locator(mapTravelsTabSelector)).toBeVisible({ timeout: 30_000 });

    const cards = page.locator(mapTravelCardSelector);
    await expect(cards).toHaveCount(mockedPoints.length, { timeout: 30_000 });
    return cards;
  };

  test('renders map travel cards as visible, bounded surfaces', async ({ page }) => {
    const cards = await openTravelCards(page);
    const firstCard = cards.first();
    await expect(firstCard).toBeVisible();

    // Check that card has proper styling
    const cardStyles = await firstCard.evaluate((el: HTMLElement) => {
      const styles = window.getComputedStyle(el);
      return {
        backgroundColor: styles.backgroundColor,
        borderRadius: styles.borderRadius,
        overflow: styles.overflow,
      };
    });

    expect(cardStyles.backgroundColor).not.toBe('transparent');
    expect(cardStyles.backgroundColor).not.toContain('rgba(0, 0, 0, 0)');
    expect(parseInt(cardStyles.borderRadius)).toBeGreaterThan(0);
    expect(cardStyles.overflow).toBe('hidden');
  });

  test('shows a neutral placeholder surface for every missing image', async ({ page }) => {
    const cards = await openTravelCards(page);
    const placeholders = cards.locator('[data-testid="image-stub"]');

    await expect(placeholders).toHaveCount(mockedPoints.length);
    await expect(placeholders.first()).toBeVisible();
    await expect(placeholders.first()).toHaveAttribute('aria-hidden', 'true');
    const placeholderBg = await placeholders.first().evaluate((element: HTMLElement) =>
      window.getComputedStyle(element).backgroundColor,
    );
    expect(placeholderBg).not.toBe('transparent');
  });

  test('constrains a long title instead of overflowing the card', async ({ page }) => {
    const cards = await openTravelCards(page);
    const title = cards.first().getByText(mockedPoints[0].address, { exact: true });
    await expect(title).toBeVisible();

    const styles = await title.evaluate((element: HTMLElement) => {
      const computed = window.getComputedStyle(element);
      return {
        overflow: computed.overflow,
        lineClamp: computed.getPropertyValue('-webkit-line-clamp'),
      };
    });
    expect(['hidden', 'clip']).toContain(styles.overflow);
    expect(Number(styles.lineClamp)).toBeGreaterThan(0);
  });

  test('keeps sibling cards aligned while allowing one extra title line', async ({ page }) => {
    const cards = await openTravelCards(page);
    const firstCardBox = await cards.nth(0).boundingBox();
    const secondCardBox = await cards.nth(1).boundingBox();

    expect(firstCardBox, 'first map card must have a layout box').not.toBeNull();
    expect(secondCardBox, 'second map card must have a layout box').not.toBeNull();
    expect(Math.abs((firstCardBox?.width ?? 0) - (secondCardBox?.width ?? 0))).toBeLessThan(1);
    expect(Math.abs((firstCardBox?.height ?? 0) - (secondCardBox?.height ?? 0))).toBeLessThanOrEqual(24);
    expect(firstCardBox?.height ?? 0).toBeGreaterThan(200);
    expect(firstCardBox?.height ?? 0).toBeLessThan(520);
  });
});
