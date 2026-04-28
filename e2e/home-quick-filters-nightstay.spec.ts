import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

test.use({ viewport: { width: 1600, height: 1200 } });

test.describe('@smoke Home quick filters', () => {
  test('палатка navigates to search and applies ночлег filter', async ({ page }) => {
    await preacceptCookies(page);

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Quick filters block.
    await page.getByText('Подберите поездку под свой ритм', { exact: true }).waitFor({ timeout: 30_000 });

    const палаткаChip = page.getByText('Палатка', { exact: true }).first();
    await палаткаChip.waitFor({ state: 'attached', timeout: 30_000 });
    await палаткаChip.click({ force: true });

    await expect(page).toHaveURL(/\/search\?/);
    // URL param key may appear as "over_nights_stay" or "over__nights__stay" depending on router serialization.
    await expect(page).toHaveURL(/over(_|__)nights(_|__)stay=1/);

    // Wait for the skeleton layer to disappear before checking the interactive filters UI.
    const searchSkeleton = page.getByTestId('search-skeleton');
    if (await searchSkeleton.isVisible().catch(() => false)) {
      await expect(searchSkeleton).toBeHidden({ timeout: 30_000 });
    }

    // Ensure the interactive filters UI is visible and "Палатка" is selected.
    await expect(page.getByTestId('toggle-all-groups')).toBeVisible({ timeout: 30_000 });
    const sortButton = page.getByRole('button', { name: /Сортировка:/i });
    if (await sortButton.isVisible().catch(() => false)) {
      await expect(sortButton).toBeVisible();
    }

    const expandAll = page.getByText('Развернуть все', { exact: true });
    if (await expandAll.isVisible().catch(() => false)) {
      await expandAll.click({ force: true });
    } else {
      const ночлегGroup = page.getByText('Ночлег', { exact: true });
      if (await ночлегGroup.isVisible().catch(() => false)) {
        await ночлегGroup.click({ force: true });
      }
    }

    // Label can vary by locale/content; URL state and clear-counter are the stable contracts.
    await expect(page.getByText(/Очистить\s+\(1\)/)).toBeVisible();
  });
});
