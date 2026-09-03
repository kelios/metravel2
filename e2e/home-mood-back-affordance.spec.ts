import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

// #1725: с главной по подсказке «Замки» попадаешь в отфильтрованный список.
// Это результат перехода, а не раздел «Маршруты» из дока, поэтому на нём обязан
// быть один явный способ вернуться. Телефонная ширина — там дыра была самой
// заметной: в нижней панели пункта «Главная» нет вовсе.
test.use({ viewport: { width: 390, height: 844 } });

test.describe('@smoke Back affordance on a filtered list', () => {
  test('home mood chip → filtered search → back to home', async ({ page }) => {
    await preacceptCookies(page);

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Ряд подсказок живёт на первом экране героя, скролл не нужен.
    const castlesChip = page.getByRole('button', { name: 'Замки. Идея поездки' }).first();
    await castlesChip.waitFor({ state: 'attached', timeout: 30_000 });
    await castlesChip.click({ force: true });

    await expect(page).toHaveURL(/\/search\?/);
    await expect(page).toHaveURL(/categoryTravelAddress=33(,|%2C)43/);

    // Во время перехода на экране на мгновение живут шапки обоих маршрутов
    // (expo-router держит табы смонтированными), поэтому берём первую.
    const contextBar = page.getByTestId('header-context-bar').first();
    await expect(contextBar).toBeVisible({ timeout: 30_000 });

    const backButton = page.getByLabel('Назад', { exact: true }).first();
    await expect(backButton).toBeVisible();

    await backButton.click({ force: true });
    await expect(page).toHaveURL(/\/(index)?$/);
  });

  test('the same list without a filter stays a section and keeps no back row', async ({ page }) => {
    await preacceptCookies(page);

    await page.goto('/search', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1_500);

    await expect(page.getByTestId('header-context-bar')).toHaveCount(0);
  });
});
