import { test, expect } from './fixtures';
import { getTravelsListPath } from './helpers/routes';
import { preacceptCookies } from './helpers/navigation';

test.describe('Footer dock (web mobile) - More modal', () => {
  test('shows More (Ещё), keeps it inside the dock, and opens legal + support links', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await preacceptCookies(page);

    // Expo dev server can occasionally return transient ERR_EMPTY_RESPONSE while hot reloading.
    // Retry navigation to reduce flakiness.
    let lastError: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
         
        await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
         
        await page.waitForTimeout(500);
      }
    }
    if (lastError) throw lastError;

    const dock = page.getByTestId('footer-dock-wrapper');
    await expect(dock).toBeVisible({ timeout: 30_000 });

    // On web mobile the dock is fixed; we reserve space via bottom-gutter.
    await expect(page.getByTestId('bottom-gutter')).toBeVisible({ timeout: 30_000 });

    // "Ещё" must exist in the dock.
    const moreInDock = dock.getByTestId('footer-item-more');
    await expect(moreInDock).toBeVisible({ timeout: 15_000 });

    // Layout invariant: the action remains fully contained in the responsive dock.
    // Its horizontal position depends on the number of visible navigation items.
    const [bb, dockBb] = await Promise.all([moreInDock.boundingBox(), dock.boundingBox()]);
    expect(bb, 'More action must have a measurable box').not.toBeNull();
    expect(dockBb, 'Footer dock must have a measurable box').not.toBeNull();
    if (!bb || !dockBb) throw new Error('Footer dock bounding boxes are unavailable');
    expect(bb.x).toBeGreaterThanOrEqual(dockBb.x - 1);
    expect(bb.x + bb.width).toBeLessThanOrEqual(dockBb.x + dockBb.width + 1);
    expect(bb.y).toBeGreaterThanOrEqual(dockBb.y - 1);
    expect(bb.y + bb.height).toBeLessThanOrEqual(dockBb.y + dockBb.height + 1);

    // Open More modal.
    await moreInDock.click();

    await expect(page.getByTestId('footer-more-sheet')).toBeVisible();
    await expect(page.getByTestId('footer-more-list')).toBeVisible();

    // Legal links exposed by the current mobile information architecture.
    const moreSheet = page.getByTestId('footer-more-sheet');
    await expect(moreSheet.getByRole('link', { name: 'Пользовательское соглашение' })).toBeVisible();
    await expect(moreSheet.getByRole('link', { name: 'Отказ от ответственности' })).toBeVisible();

    // Support channel: email.
    await expect(moreSheet.getByRole('link', { name: 'Связаться с нами' })).toBeVisible();

    // Close modal by clicking backdrop.
    await page.getByTestId('footer-more-backdrop').click({ position: { x: 10, y: 10 } });
    await expect(page.getByTestId('footer-more-sheet')).toBeHidden();
  });

  test('traps keyboard focus, closes on Escape, and restores focus to the trigger', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await preacceptCookies(page);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });

    const trigger = page.getByTestId('footer-item-more');
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await trigger.press('Enter');

    const sheet = page.getByTestId('footer-more-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Закрыть' })).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect
      .poll(() =>
        page.evaluate(() => Boolean(document.activeElement?.closest('[data-testid="footer-more-sheet"]')))
      )
      .toBe(true);

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
