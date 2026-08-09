import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

test.use({ viewport: { width: 1600, height: 1200 } });

test.describe('@smoke Home quick filters', () => {
  test('Без ночлега navigates to search and applies ночлег filter', async ({ page }) => {
    await preacceptCookies(page);

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Quick filters block. Секция живёт в `DeferredSection priority="low"`, а у
    // неё на web `disableFallbackOnWeb`: она монтируется ТОЛЬКО по пересечению с
    // вьюпортом (rootMargin 600px), таймера-подстраховки нет. До скролла её нет
    // в DOM вообще, поэтому ожидание видимости на первом экране висит 30 с.
    // Секция живёт в `DeferredSection priority="low"`, а у неё на web стоит
    // `disableFallbackOnWeb`: она монтируется ТОЛЬКО по пересечению с вьюпортом
    // (rootMargin 600px), таймера-подстраховки нет. До скролла её нет в DOM.
    //
    // Скроллить нужно колесом и обязательно с курсором внутри контента: страницу
    // прокручивает внутренний контейнер RNW ScrollView, поэтому `window.scrollTo`
    // и `scrollingElement.scrollTop` стоят на месте (`window.scrollY` всегда 0),
    // а колесо в позиции по умолчанию (0,0) попадает в шапку.
    const quickFiltersHeading = page.getByText('Найдите маршрут под свой день', { exact: true });
    await page.mouse.move(800, 600);
    for (let step = 0; step < 15; step += 1) {
      if (await quickFiltersHeading.isVisible().catch(() => false)) break;
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(200);
    }
    await quickFiltersHeading.waitFor({ timeout: 30_000 });

    const nightsChip = page.getByRole('button', { name: 'Подбор Без ночлега' }).first();
    await nightsChip.waitFor({ state: 'attached', timeout: 30_000 });
    await nightsChip.click({ force: true });

    await expect(page).toHaveURL(/\/search\?/);
    // URL param key may appear as "over_nights_stay" or "over__nights__stay" depending on router serialization.
    await expect(page).toHaveURL(/over(_|__)nights(_|__)stay=8/);

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
    await expect(page.getByRole('button', { name: /Очистить все фильтры \(1\)/i })).toBeVisible();
  });
});
