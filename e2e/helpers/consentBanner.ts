import { expect, type Page } from '@playwright/test';

/**
 * #2162: единственный способ e2e закрыть cookie-баннер — по его testID
 * (`components/layout/ConsentBanner.tsx`: `consent-banner`, `consent-accept`,
 * `consent-decline`), а не по формулировке. Три локальные копии искали кнопки
 * по русскому тексту: после смены копирайта (#2135) часть кандидатов умерла
 * молча, а копия в global-setup не нажимала ничего. Правило держит
 * `__tests__/e2e/consentBannerLocators.governance.test.ts`.
 *
 * Где согласие можно посеять заранее, сей его (`preacceptCookies`), а не
 * кликай: этот хелпер — для сценариев, где баннер должен появиться.
 */
const BANNER_APPEAR_WINDOW_MS = 1500;

export async function dismissConsentBanner(
  page: Page,
  choice: 'accept' | 'decline' = 'accept',
): Promise<void> {
  const banner = page.getByTestId('consent-banner');
  const shown = await banner
    .waitFor({ state: 'visible', timeout: BANNER_APPEAR_WINDOW_MS })
    .then(() => true, () => false);
  // Баннера нет — согласие уже сохранено (или маршрут его не показывает).
  if (!shown) return;

  await page.getByTestId(choice === 'accept' ? 'consent-accept' : 'consent-decline').click();
  await expect(banner, 'cookie-баннер не закрылся после выбора').toBeHidden();
}
