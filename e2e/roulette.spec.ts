import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

test.describe('Roulette', () => {
  test('spins and reaches a defined result or empty state', async ({ page }) => {
    await preacceptCookies(page);

    await page.goto('/roulette', { waitUntil: 'domcontentloaded' });

    const spin = page.getByRole('button', { name: 'Крутить рулетку' }).first();
    await expect(spin).toBeVisible({ timeout: 30_000 });
    await expect(spin).toBeEnabled();
    await spin.click();

    const resultCards = page.locator('[data-testid="travel-card-link"]');
    const emptyState = page.getByText('Ничего не нашли', { exact: false });
    await expect(resultCards.first().or(emptyState).first()).toBeVisible({ timeout: 30_000 });
  });
});
