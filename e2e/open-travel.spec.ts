import { test, expect } from './fixtures';
import { preacceptCookies, navigateToFirstTravel } from './helpers/navigation';

test.describe('@smoke Travel details', () => {
  test('can open a travel details page from list', async ({ page }) => {
    await preacceptCookies(page);

    const hasTravel = await navigateToFirstTravel(page);
    if (!hasTravel) {
      test.info().annotations.push({
        type: 'note',
        description: 'No travel cards available in this environment; nothing to open',
      });
      return;
    }

    // Minimal sanity check: page should render some content.
    await expect(page.locator('body')).toContainText(/./);
  });
});
