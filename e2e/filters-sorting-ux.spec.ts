import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

const FILTER_TIMEOUT_MS = 30_000;
const DEBOUNCE_MS = 600;

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

test.describe('@smoke Filters and Sorting UX', () => {
  test.beforeEach(async ({ page }) => {
    await preacceptCookies(page);
    await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded' });
    
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
    await sortDropdown.click();
    await page.waitForTimeout(300);
    
    // Sort options should be visible
    const sortOptions = page.getByRole('radio', { name: /Новые|Старые|Популярные|Рейтинг|Добавлены|Название/i });
    await expect(sortOptions.first()).toBeVisible({ timeout: 5000 });
    
    // Count visible sort options
    const count = await sortOptions.count();
    expect(count).toBeGreaterThan(5); // Should have multiple sort options
  });

  test('sort dropdown closes after selection and updates display', async ({ page }) => {
    // Open sort dropdown
    const sortDropdown = page.getByRole('button', { name: /Сортировка:/i });
    await expect(sortDropdown).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    await sortDropdown.click();
    await page.waitForTimeout(300);
    
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
    const sortDropdown = page.getByRole('button', { name: /Сортировка:/i });
    await sortDropdown.click();
    await page.waitForTimeout(300);
    
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
      test.skip();
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
    const groupHeader = page.getByRole('button', { name: /^Развернуть\s+/i }).first();
    await expect(groupHeader).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    
    // Click to expand
    await groupHeader.click();
    await page.waitForTimeout(400); // Wait for animation
    
    // After expanding, button label should change to "Свернуть"
    const collapseButton = page.getByRole('button', { name: /^Свернуть\s+/i }).first();
    await expect(collapseButton).toBeVisible({ timeout: 5000 });
    
    // Click to collapse
    await collapseButton.click();
    await page.waitForTimeout(400);
    
    // Button should be back to "Развернуть"
    await expect(page.getByRole('button', { name: /^Развернуть\s+/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('group clear button appears when filters are selected', async ({ page }) => {
    // Expand a filter group
    const groupHeader = page.getByRole('button', { name: /^Развернуть\s+/i }).first();
    await expect(groupHeader).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    await groupHeader.click();
    await page.waitForTimeout(400);
    
    // Select a filter option (checkbox in the expanded group)
    const filterOption = await getUncheckedGroupFilterCheckbox(page);
    await expect(filterOption).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    
    await filterOption.click();
    await page.waitForTimeout(DEBOUNCE_MS);
    
    // Clear button should appear
    const clearButton = page.getByRole('button', { name: /Очистить \d+ выбранных/i });
    await expect(clearButton).toBeVisible({ timeout: 5000 });
  });

  test('group clear button clears only that group', async ({ page }) => {
    // Expand a filter group
    const groupHeader = page.getByRole('button', { name: /^Развернуть\s+/i }).first();
    await expect(groupHeader).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    await groupHeader.click();
    await page.waitForTimeout(400);
    
    // Select a filter
    const filterOption = await getFirstGroupFilterCheckbox(page);
    await expect(filterOption).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    
    await filterOption.click();
    await page.waitForTimeout(DEBOUNCE_MS);
    
    // Click group clear button
    const groupClearButton = page.getByRole('button', { name: /Очистить \d+ выбранных/i }).first();
    await expect(groupClearButton).toBeVisible({ timeout: 5000 });
    await groupClearButton.click({ force: true });
    await page.waitForTimeout(DEBOUNCE_MS);
    
    // Filter should be unchecked
    const isChecked = await filterOption.getAttribute('aria-checked');
    expect(isChecked).toBe('false');
  });

  test('filter options have hover state on desktop', async ({ page, isMobile }) => {
    if (isMobile) {
      test.skip();
    }

    // Expand a group
    const groupHeader = page.getByRole('button', { name: /^Развернуть\s+/i }).first();
    await expect(groupHeader).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    await groupHeader.click();
    await page.waitForTimeout(400);
    
    const filterOption = await getFirstGroupFilterCheckbox(page);
    await expect(filterOption).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    
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
    // Expand a group
    const groupHeader = page.getByRole('button', { name: /^Развернуть\s+/i }).first();
    await expect(groupHeader).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    await groupHeader.click();
    await page.waitForTimeout(400);
    
    // Select a filter
    const filterOption = await getFirstGroupFilterCheckbox(page);
    await expect(filterOption).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    
    await filterOption.click();
    await page.waitForTimeout(DEBOUNCE_MS);
    
    // Group-level clear control should appear when at least one option is selected
    const groupClearButton = page.getByRole('button', { name: /Очистить \d+ выбранных/i }).first();
    await expect(groupClearButton).toBeVisible({ timeout: 5000 });
  });

  test('clear all button clears all filters', async ({ page }) => {
    // Expand and select a filter
    const groupHeader = page.getByRole('button', { name: /^Развернуть\s+/i }).first();
    await expect(groupHeader).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    await groupHeader.click();
    await page.waitForTimeout(400);
    
    const filterOption = await getFirstGroupFilterCheckbox(page);
    await expect(filterOption).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    
    await filterOption.click();
    await page.waitForTimeout(DEBOUNCE_MS);
    
    // Click global clear button (in header or mobile clear all)
    const clearAllButton = page.getByRole('button', { name: /Очистить \(\d+\)|Очистить все фильтры/i }).first();
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
    const sortDropdown = page.getByRole('button', { name: /Сортировка:/i });
    await expect(sortDropdown).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    
    // Open sort dropdown to check radio options
    await sortDropdown.click();
    await page.waitForTimeout(300);
    
    // Sort options should be radio buttons
    const sortRadios = page.getByRole('radio');
    expect(await sortRadios.count()).toBeGreaterThan(0);
    
    // Close dropdown
    await sortDropdown.click();
    await page.waitForTimeout(300);
    
    // Filter group headers should be buttons
    const groupHeader = page.getByRole('button', { name: /^Развернуть\s+/i }).first();
    await expect(groupHeader).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    await groupHeader.click();
    await page.waitForTimeout(400);
    
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
    const expandButton = page.getByRole('button', { name: /^Развернуть\s+/i }).first();
    await expect(expandButton).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    
    // Click to expand
    await expandButton.click();
    await page.waitForTimeout(400);
    
    // Label should change to "Свернуть"
    const collapseButton = page.getByRole('button', { name: /^Свернуть\s+/i }).first();
    await expect(collapseButton).toBeVisible({ timeout: 5000 });
  });

  test('results count updates when filters change', async ({ page }) => {
    // Expand and select a filter
    const groupHeader = page.getByRole('button', { name: /^Развернуть\s+/i }).first();
    await expect(groupHeader).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    await groupHeader.click();
    await page.waitForTimeout(400);
    
    const filterOption = await getFirstGroupFilterCheckbox(page);
    await expect(filterOption).toBeVisible({ timeout: FILTER_TIMEOUT_MS });
    
    await filterOption.click();
    await page.waitForTimeout(DEBOUNCE_MS);
    
    // Results should update (either count changes or cards reload)
    await Promise.race([
      page.waitForSelector('[data-testid="travel-card-link"]', { timeout: FILTER_TIMEOUT_MS }),
      page.waitForSelector('text=Пока нет путешествий', { timeout: FILTER_TIMEOUT_MS }),
      page.waitForSelector('text=/Найдено/i', { timeout: FILTER_TIMEOUT_MS }),
    ]);
  });
});
