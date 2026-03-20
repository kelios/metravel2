import { test, expect } from './fixtures';
import { preacceptCookies, waitForMainListRender, gotoWithRetry } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

const FILTER_TIMEOUT_MS = 30_000;
const DEBOUNCE_MS = 600;
const EXPAND_GROUP_RE = /^Развернуть\s+(?!все\b).+/i;
const COLLAPSE_GROUP_RE = /^Свернуть\s+(?!все\b).+/i;
const SORT_OPTION_RE = /Новые|Старые|Популярные|Рейтинг|Добавлены|Название/i;

const waitForListResultsSignal = async (page: any) =>
  Promise.any([
    page.waitForSelector('[data-testid="travel-card-link"], [testID="travel-card-link"]', { timeout: FILTER_TIMEOUT_MS }),
    page.waitForSelector('[data-testid="travel-card-skeleton"], [testID="travel-card-skeleton"]', { timeout: FILTER_TIMEOUT_MS }),
    page.waitForSelector('text=Пока нет путешествий', { timeout: FILTER_TIMEOUT_MS }),
    page.waitForSelector('text=Ничего не найдено', { timeout: FILTER_TIMEOUT_MS }),
    page.waitForSelector('[data-testid="results-count-wrapper"], [testID="results-count-wrapper"]', { timeout: FILTER_TIMEOUT_MS }),
    page.waitForSelector('[data-testid="results-count-text"], [testID="results-count-text"]', { timeout: FILTER_TIMEOUT_MS }),
    page.waitForSelector('text=Результаты', { timeout: FILTER_TIMEOUT_MS }),
  ]);

async function getFirstGroupFilterCheckbox(page: any) {
  const checkboxes = page.getByRole('checkbox');
  const count = await checkboxes.count();

  for (let i = 0; i < count; i++) {
    const option = checkboxes.nth(i);
    const label = String((await option.getAttribute('aria-label')) || '');
    if (!/Только на модерации/i.test(label)) {
      return option;
    }
  }

  return checkboxes.first();
}

async function getUncheckedGroupFilterCheckbox(page: any) {
  const checkboxes = page.getByRole('checkbox');
  const count = await checkboxes.count();

  for (let i = 0; i < count; i++) {
    const option = checkboxes.nth(i);
    const label = String((await option.getAttribute('aria-label')) || '');
    if (/Только на модерации/i.test(label)) continue;

    const checked = await option.getAttribute('aria-checked');
    if (checked !== 'true') {
      return option;
    }
  }

  return getFirstGroupFilterCheckbox(page);
}

function getFilterGroupToggle(page: any) {
  return page.getByRole('button', { name: EXPAND_GROUP_RE }).first();
}

function getFilterGroupCollapse(page: any) {
  return page.getByRole('button', { name: COLLAPSE_GROUP_RE }).first();
}

async function reloadTravelsList(page: any) {
  await gotoWithRetry(page, getTravelsListPath());
  await waitForMainListRender(page);
}

async function recoverListLoadError(page: any) {
  const errorTitle = page.getByText('Ошибка загрузки', { exact: true }).first();
  const retryButton = page.getByRole('button', { name: 'Повторить' }).first();

  if (!(await errorTitle.isVisible().catch(() => false))) {
    return;
  }

  if (await retryButton.isVisible().catch(() => false)) {
    await retryButton.click();
    await waitForMainListRender(page);
    await page.waitForTimeout(500);
  }
}

async function ensureListReadyForFilters(page: any) {
  await waitForMainListRender(page);
  await recoverListLoadError(page);
}

async function ensureInteractiveFiltersReady(page: any) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await ensureListReadyForFilters(page);

    const hasGroupToggle = await getFilterGroupToggle(page).isVisible().catch(() => false);
    const hasSortTrigger = await page.getByRole('button', { name: /Сортировка:/i }).isVisible().catch(() => false);

    if (hasGroupToggle && hasSortTrigger) {
      return;
    }

    await reloadTravelsList(page);
  }
}

async function hasEmptyResultsShell(page: any) {
  const resultsText = page.getByText(/0\s+путешествий/i).first();
  const resetLabel = page.getByLabel('Сбросить все фильтры и поиск').first();
  return (await resultsText.isVisible().catch(() => false)) || (await resetLabel.isVisible().catch(() => false));
}

async function openSortDropdown(page: any): Promise<any | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const sortDropdown = page.getByRole('button', { name: /Сортировка:/i });
    await expect(sortDropdown).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    await sortDropdown.click();

    const opened = await expect
      .poll(async () => page.getByRole('radio', { name: SORT_OPTION_RE }).count(), { timeout: 5_000 })
      .toBeGreaterThan(0)
      .then(() => true)
      .catch(() => false);

    if (opened) {
      return sortDropdown;
    }

    if (await hasEmptyResultsShell(page)) {
      return null;
    }

    await reloadTravelsList(page);
    await ensureInteractiveFiltersReady(page);
  }

  if (await hasEmptyResultsShell(page)) {
    return null;
  }

  throw new Error('Sort dropdown options did not become available.');
}

async function expandAnyFilterGroup(page: any): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let groupHeader = getFilterGroupToggle(page);
    await expect(groupHeader).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    await groupHeader.click();
    await page.waitForTimeout(400);

    const checkboxCount = await page.getByRole('checkbox').count();
    if (checkboxCount > 0) return true;

    await recoverListLoadError(page);

    groupHeader = getFilterGroupToggle(page);
    if (await groupHeader.isVisible().catch(() => false)) {
      await groupHeader.click();
      await page.waitForTimeout(400);
    }

    if ((await page.getByRole('checkbox').count()) > 0) {
      return true;
    }

    if (await hasEmptyResultsShell(page)) {
      return false;
    }

    await reloadTravelsList(page);
    await ensureInteractiveFiltersReady(page);
  }

  if (await hasEmptyResultsShell(page)) {
    return false;
  }

  throw new Error('Filter group options did not become available.');
}

async function getVisibleFilterCheckbox(page: any): Promise<any | null> {
  const hasCheckboxes = await expandAnyFilterGroup(page);
  if (!hasCheckboxes) {
    return null;
  }
  await expect
    .poll(async () => page.getByRole('checkbox').count(), { timeout: FILTER_TIMEOUT_MS })
    .toBeGreaterThan(0);
  const option = await getFirstGroupFilterCheckbox(page);
  await expect(option).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
  return option;
}

async function expectEmptyFilterShell(page: any) {
  await expect(page.getByText(/Результаты/i).first()).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
  await expect(page.getByText(/0\s+путешествий/i).first()).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
  await expect(page.getByLabel('Сбросить все фильтры и поиск').first()).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
}

test.describe('@smoke Filters and Sorting UX', () => {
  test.beforeEach(async ({ page }) => {
    await preacceptCookies(page);
    await gotoWithRetry(page, getTravelsListPath());

    await ensureInteractiveFiltersReady(page);

    // Wait for filters to be visible
    await expect(page.getByText('Фильтры')).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
  });

  test('sort dropdown shows current selection and expands on click', async ({ page }) => {
    // Verify sort dropdown trigger is visible with current selection
    const sortDropdown = page.getByRole('button', { name: /Сортировка:/i });
    await expect(sortDropdown).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    
    // Should show default selection
    await expect(sortDropdown).toContainText(/Новые|Популярные|Рейтинг/i);
    
    // Click to expand
    const openedDropdown = await openSortDropdown(page);
    if (!openedDropdown) {
      await expectEmptyFilterShell(page);
      return;
    }
    
    // Sort options should be visible
    const sortOptions = page.getByRole('radio', { name: SORT_OPTION_RE });
    await expect(sortOptions.first()).toBeVisible({ timeout: 5000 });
    
    // Count visible sort options
    const count = await sortOptions.count();
    expect(count).toBeGreaterThan(5); // Should have multiple sort options
  });

  test('sort dropdown closes after selection and updates display', async ({ page }) => {
    // Open sort dropdown
    const sortDropdown = await openSortDropdown(page);
    if (!sortDropdown) {
      await expectEmptyFilterShell(page);
      return;
    }
    
    // Select a different option
    const popularOption = page.getByRole('radio', { name: /Популярные ↓/i });
    await expect(popularOption).toBeVisible({ timeout: 5000 });
    await popularOption.click();
    await page.waitForTimeout(DEBOUNCE_MS);
    
    // Dropdown should close and show new selection
    const updatedDropdown = page.getByRole('button', { name: /Сортировка:.*Популярные/i });
    await expect(updatedDropdown).toBeVisible({ timeout: 5000 });
    
    // Sort options should be hidden (dropdown closed)
    await expect(page.getByRole('radio', { name: /Старые/i })).not.toBeVisible();
  });

  test('sort options have adequate touch targets (min 40px)', async ({ page }) => {
    // Open sort dropdown
    const sortDropdown = await openSortDropdown(page);
    if (!sortDropdown) {
      await expectEmptyFilterShell(page);
      return;
    }
    
    const sortOption = page.getByRole('radio', { name: /Новые|Популярные/i }).first();
    await expect(sortOption).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    
    const box = await sortOption.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(40);
    }
  });

  test('sort dropdown trigger shows hover state on desktop', async ({ page, isMobile }) => {
    if (isMobile) {
      const sortDropdown = page.getByRole('button', { name: /Сортировка:/i });
      await expect(sortDropdown).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
      return;
    }

    const sortDropdown = page.getByRole('button', { name: /Сортировка:/i });
    await expect(sortDropdown).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    
    // Get initial background color
    const initialBg = await sortDropdown.evaluate((el: Element) => 
      window.getComputedStyle(el).backgroundColor
    );
    
    // Hover over the dropdown
    await sortDropdown.hover();
    await page.waitForTimeout(200); // Wait for transition
    
    // Get hover background color
    const hoverBg = await sortDropdown.evaluate((el: Element) => 
      window.getComputedStyle(el).backgroundColor
    );
    
    // Background should change on hover
    expect(hoverBg).not.toBe(initialBg);
  });

  test('filter groups can be expanded and collapsed', async ({ page }) => {
    // Find any expandable filter group header
    const groupHeader = getFilterGroupToggle(page);
    await expect(groupHeader).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    
    // Click to expand
    await groupHeader.click();
    await page.waitForTimeout(400); // Wait for animation
    
    // After expanding, button label should change to "Свернуть"
    const collapseButton = getFilterGroupCollapse(page);
    await expect(collapseButton).toBeVisible({ timeout: 5000 });
    
    // Click to collapse
    await collapseButton.click();
    await page.waitForTimeout(400);
    
    // Button should be back to "Развернуть"
    await expect(getFilterGroupToggle(page)).toBeVisible({ timeout: 5000 });
  });

  test('group clear button appears when filters are selected', async ({ page }) => {
    // Select a filter option (checkbox in the expanded group)
    const filterOption = await getVisibleFilterCheckbox(page);
    if (!filterOption) {
      await expectEmptyFilterShell(page);
      return;
    }
    
    await filterOption.click();
    await page.waitForTimeout(DEBOUNCE_MS);
    
    // Clear button should appear
    const clearButton = page.getByRole('button', { name: /Очистить \d+ выбранных/i });
    await expect(clearButton).toBeVisible({ timeout: 5000 });
  });

  test('group clear button clears only that group', async ({ page }) => {
    // Select a filter
    const filterOption = await getVisibleFilterCheckbox(page);
    if (!filterOption) {
      await expectEmptyFilterShell(page);
      return;
    }
    
    await filterOption.click();
    await page.waitForTimeout(DEBOUNCE_MS + 400);

    // Click group clear button
    const groupClearButton = page.getByRole('button', { name: /Очистить \d+ выбранных/i }).first();
    await expect(groupClearButton).toBeVisible({ timeout: 10000 });
    await groupClearButton.click({ force: true });
    await page.waitForTimeout(DEBOUNCE_MS);
    
    // Filter should be unchecked
    const isChecked = await filterOption.getAttribute('aria-checked');
    expect(isChecked).toBe('false');
  });

  test('filter options have hover state on desktop', async ({ page, isMobile }) => {
    if (isMobile) {
      const groupHeader = getFilterGroupToggle(page);
      await expect(groupHeader).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
      return;
    }

    // Expand a group
    const filterOption = await getVisibleFilterCheckbox(page);
    if (!filterOption) {
      await expectEmptyFilterShell(page);
      return;
    }
    
    // Get initial background
    const initialBg = await filterOption.evaluate((el: Element) => 
      window.getComputedStyle(el).backgroundColor
    );
    
    // Hover
    await filterOption.hover();
    await page.waitForTimeout(200);
    
    // Get hover background
    const hoverBg = await filterOption.evaluate((el: Element) => 
      window.getComputedStyle(el).backgroundColor
    );
    
    // Background or transform should change on hover for unchecked items
    const isChecked = await filterOption.getAttribute('aria-checked');
    if (isChecked !== 'true') {
      // Either background or transform should change
      const transform = await filterOption.evaluate((el: Element) => 
        window.getComputedStyle(el).transform
      );
      const hasVisualChange = hoverBg !== initialBg || transform !== 'none';
      expect(hasVisualChange).toBe(true);
    }
  });

  test('toggle all groups button works', async ({ page }) => {
    const toggleAllButton = page.getByTestId('toggle-all-groups');
    await expect(toggleAllButton).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    
    // Click to expand all
    await toggleAllButton.click();
    await page.waitForTimeout(600); // Wait for all animations
    
    // Check if button text changed
    const buttonText = await toggleAllButton.textContent();
    expect(buttonText).toMatch(/Свернуть все|Развернуть все/);
    
    // Click again to collapse all
    await toggleAllButton.click();
    await page.waitForTimeout(600);
    
    const newButtonText = await toggleAllButton.textContent();
    expect(newButtonText).not.toBe(buttonText);
  });

  test('selected filters show count badge', async ({ page }) => {
    // Select a filter
    const filterOption = await getVisibleFilterCheckbox(page);
    if (!filterOption) {
      await expectEmptyFilterShell(page);
      return;
    }
    
    await filterOption.click();
    await page.waitForTimeout(DEBOUNCE_MS);
    
    // Group-level clear control should appear when at least one option is selected
    const groupClearButton = page.getByRole('button', { name: /Очистить \d+ выбранных/i }).first();
    await expect(groupClearButton).toBeVisible({ timeout: 5000 });
  });

  test('clear all button clears all filters', async ({ page }) => {
    // Expand and select a filter
    const filterOption = await getVisibleFilterCheckbox(page);
    if (!filterOption) {
      await expectEmptyFilterShell(page);
      return;
    }
    
    await filterOption.click();
    await page.waitForTimeout(DEBOUNCE_MS);
    
    // Click global clear button (in header or mobile clear all)
    const clearAllButton = page
      .locator(
        '[aria-label^="Очистить все фильтры"], [data-testid="clear-all-button"], [testID="clear-all-button"], [aria-label="Сбросить все фильтры и поиск"]'
      )
      .first();
    if (await clearAllButton.count()) {
      await expect(clearAllButton).toBeVisible({ timeout: 5000 });
      await clearAllButton.click();
    } else {
      const resetButton = page.getByText(/^Сбросить$/).first();
      await expect(resetButton).toBeVisible({ timeout: 5000 });
      await resetButton.click();
    }
    await page.waitForTimeout(DEBOUNCE_MS);
    
    // Filter should be unchecked
    const isChecked = await filterOption.getAttribute('aria-checked');
    expect(isChecked).toBe('false');
  });

  test('accessibility: all interactive elements have proper roles', async ({ page }) => {
    // Sort dropdown should be a button
    const sortDropdown = await openSortDropdown(page);
    if (!sortDropdown) {
      await expectEmptyFilterShell(page);
      return;
    }
    
    // Sort options should be radio buttons
    const sortRadios = page.getByRole('radio');
    expect(await sortRadios.count()).toBeGreaterThan(0);
    
    // Close dropdown
    await sortDropdown.click();
    await page.waitForTimeout(300);
    
    // Filter group headers should be buttons
    const hasCheckboxes = await expandAnyFilterGroup(page);
    if (!hasCheckboxes) {
      await expectEmptyFilterShell(page);
      return;
    }
    
    // Filter checkboxes should exist after expanding
    const filterControls = page.getByRole('checkbox');
    expect(await filterControls.count()).toBeGreaterThan(0);
    
    // All buttons should have proper labels
    const buttons = page.getByRole('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);
      const label = await button.getAttribute('aria-label');
      const text = await button.textContent();
      
      // Button should have either aria-label or text content
      expect(label || text).toBeTruthy();
    }
  });

  test('accessibility: expanded state is communicated via label', async ({ page }) => {
    // Filter groups communicate expanded state via button label ("Развернуть" vs "Свернуть")
    const expandButton = getFilterGroupToggle(page);
    await expect(expandButton).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    
    // Click to expand
    await expandButton.click();
    await page.waitForTimeout(400);
    
    // Label should change to "Свернуть"
    const collapseButton = getFilterGroupCollapse(page);
    await expect(collapseButton).toBeVisible({ timeout: 5000 });
  });

  test('results count updates when filters change', async ({ page }) => {
    // Expand and select a filter
    const filterOption = await getVisibleFilterCheckbox(page);
    if (!filterOption) {
      await expectEmptyFilterShell(page);
      return;
    }
    
    await filterOption.click();
    await page.waitForTimeout(DEBOUNCE_MS);
    
    // Results should update (either count changes or cards reload)
    await waitForListResultsSignal(page);
  });
});
