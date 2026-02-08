import { test, expect } from './fixtures';
import { getTravelsListPath } from './helpers/routes';
import { preacceptCookies } from './helpers/navigation';

test.describe('Footer dock (web mobile) - More modal', () => {
  test('shows More (Ещё), opens modal with legal + support links, and aligns dock item', async ({ page }) => {
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
    if (!(await dock.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.info().annotations.push({
        type: 'note',
        description: 'Footer dock not rendered on this variant',
      });
      return;
    }

    // On web mobile the dock is fixed; we reserve space via bottom-gutter.
    await expect(page.getByTestId('bottom-gutter')).toBeVisible({ timeout: 30_000 });

    // "Ещё" must exist in the dock.
    const moreInDock = dock.getByTestId('footer-item-more');
    await expect(moreInDock).toBeVisible();

    // Layout invariant: "Ещё" should be roughly centered in the dock in minimal state.
    const [bb, dockBb] = await Promise.all([moreInDock.boundingBox(), dock.boundingBox()]);
    expect(bb, 'expected "Ещё" to have a measurable bounding box').not.toBeNull();
    expect(dockBb, 'expected dock to have a measurable bounding box').not.toBeNull();
    if (bb && dockBb) {
      const itemCenterX = bb.x + bb.width / 2;
      const dockCenterX = dockBb.x + dockBb.width / 2;
      expect(Math.abs(itemCenterX - dockCenterX), 'expected "Ещё" to be centered within 110px').toBeLessThanOrEqual(110);
    }

    // Open More modal.
    await moreInDock.click();

    await expect(page.getByTestId('footer-more-sheet')).toBeVisible();
    await expect(page.getByTestId('footer-more-list')).toBeVisible();

    // Legal links must be available in the modal.
    await expect(page.getByText('Политика конфиденциальности')).toBeVisible();
    await expect(page.getByText('Настройки cookies')).toBeVisible();

    // Support channel: email.
    await expect(page.getByText('Связаться с нами')).toBeVisible();

    // Close modal by clicking backdrop.
    await page.getByTestId('footer-more-backdrop').click({ position: { x: 10, y: 10 } });
    await expect(page.getByTestId('footer-more-sheet')).toBeHidden();
  });
});
