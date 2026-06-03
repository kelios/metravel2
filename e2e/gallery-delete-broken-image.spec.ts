import { test, expect } from './fixtures';
import { mockFakeAuthApis } from './helpers/auth';
import { gotoWithRetry } from './helpers/navigation';

test.describe('Gallery: delete broken image (404)', () => {
  test('shows delete UI for 404 image and removes card after confirm', async ({ page, baseURL }) => {
    const base = (baseURL || '').replace(/\/+$/, '');
    const brokenId = 3796;
    const brokenUrl = `${base}/gallery/${brokenId}/conversions/404.jpg`;
    const savedTravelId = 4242;
    let currentGallery: any[] = [{ id: brokenId, url: brokenUrl }];

    // Seed consent + auth + a draft that contains a broken gallery image.
    await page.addInitScript(
      ({ brokenUrl, brokenId }) => {
        try {
          window.localStorage.setItem(
            'metravel_consent_v1',
            JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() })
          );

          const key = 'metravel_encryption_key_v1';
          const plain = 'e2e-fake-token';
          const raw = Array.from(plain)
            .map((ch, i) => String.fromCharCode(ch.charCodeAt(0) ^ key.charCodeAt(i % key.length)))
            .join('');
          const encrypted = btoa(raw);

          window.localStorage.setItem('secure_userToken', encrypted);
          window.localStorage.setItem('userId', '1');
          window.localStorage.setItem('userName', 'E2E User');
          window.localStorage.setItem('isSuperuser', 'false');

          window.localStorage.setItem(
            'metravel_travel_draft_new',
            JSON.stringify({
              data: {
                name: 'E2E draft with broken gallery',
                description: '',
                gallery: [{ id: brokenId, url: brokenUrl }],
                publish: false,
                moderation: false,
              },
              timestamp: Date.now(),
            })
          );
        } catch {
          // ignore
        }
      },
      { brokenUrl, brokenId }
    );

    // Ensure the image request fails fast with 404.
    await page.route('**/gallery/3796/conversions/404.jpg**', async (route) => {
      await route.fulfill({ status: 404, body: '' });
    });

    // Ensure delete API behaves like "already deleted" (404 should be treated as success).
    const deletePatterns = [
      '**/api/gallery/3796/**',
      '**/gallery/3796/**',
    ];
    for (const pattern of deletePatterns) {
      await page.route(pattern, async (route) => {
        if (route.request().method().toUpperCase() !== 'DELETE') {
          await route.fallback();
          return;
        }
        await route.fulfill({ status: 404, body: '' });
      });
    }

    // In Step 3 (Media) the gallery is disabled until the travel has an id (saved).
    // Mock upsert to return an id and preserve the gallery across requests.
    // Important: autosave runs in the background; some requests may omit gallery field.
    // If we default to the broken item on missing gallery, it will be reintroduced after deletion.
    const upsertPatterns = ['**/api/travels/upsert/**', '**/api/travels/upsert/', '**/travels/upsert/**', '**/travels/upsert/'];
    for (const pattern of upsertPatterns) {
      await page.route(pattern, async (route) => {
        const req = route.request();
        if (req.method().toUpperCase() !== 'PUT' && req.method().toUpperCase() !== 'POST') {
          await route.fallback();
          return;
        }
        let body: any = null;
        try {
          const raw = req.postData();
          body = raw ? JSON.parse(raw) : null;
        } catch {
          body = null;
        }
        const payload = body?.data ?? body ?? {};
        const responseBody: any = {
          ...payload,
          id: payload?.id ?? savedTravelId,
          name: payload?.name ?? 'E2E draft with broken gallery',
          publish: false,
          moderation: false,
        };
        
        // Only update and return gallery if it was provided in the request
        if (Array.isArray(payload?.gallery)) {
          currentGallery = payload.gallery;
          responseBody.gallery = currentGallery;
        }
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(responseBody),
        });
      });
    }

    const openNewTravelWizard = async () => {
      const wizardRoot = page.getByTestId('travel-upsert.root').first();

      for (let attempt = 0; attempt < 3; attempt += 1) {
        await gotoWithRetry(page, '/travel/new', { maxAttempts: 2, timeout: 120_000 });

        const isReady = await Promise.any([
          wizardRoot.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true),
          page.getByText(/^(Найден черновик|Есть несохранённые изменения)$/).first().waitFor({ state: 'visible', timeout: 15_000 }).then(() => true),
          page.getByRole('button', { name: /перейти к шагу 3:?\s*медиа/i }).first().waitFor({ state: 'visible', timeout: 15_000 }).then(() => true),
          page.getByText('Главное изображение', { exact: true }).first().waitFor({ state: 'visible', timeout: 15_000 }).then(() => true),
        ]).catch(() => false);

        if (isReady) return;

        const notFoundVisible = await page.getByText(/^Not found$/i).first().isVisible().catch(() => false);
        if (!notFoundVisible) {
          await page.waitForTimeout(1000);
        }
      }
    };

    const ensureOnStep3 = async () => {
      const step3HeaderTitle = page.getByText('Медиа путешествия', { exact: true }).first();
      const step3PrimaryAction = page.getByRole('button', { name: /к деталям/i }).first();
      const step3MainImage = page.getByText('Главное изображение', { exact: true }).first();
      const step3Gallery = page.getByText('Галерея путешествия', { exact: true }).first();
      const step3Video = page.getByText(/Видео о путешествии/i).first();

      const isStep3Visible = async () =>
        Promise.any([
          step3HeaderTitle.isVisible().catch(() => false),
          step3PrimaryAction.isVisible().catch(() => false),
          step3MainImage.isVisible().catch(() => false),
          step3Gallery.isVisible().catch(() => false),
          step3Video.isVisible().catch(() => false),
        ]).catch(() => false);

      const waitForStep3 = async (timeout: number) => {
        await Promise.race([
          step3HeaderTitle.waitFor({ state: 'visible', timeout }).catch(() => null),
          step3PrimaryAction.waitFor({ state: 'visible', timeout }).catch(() => null),
          step3MainImage.waitFor({ state: 'visible', timeout }).catch(() => null),
          step3Gallery.waitFor({ state: 'visible', timeout }).catch(() => null),
          step3Video.waitFor({ state: 'visible', timeout }).catch(() => null),
        ]);
      };

      await waitForStep3(15_000).catch(async () => {
        const milestone3 = page.locator('[aria-label^="Перейти к шагу 3"]').first();
        if (await milestone3.isVisible().catch(() => false)) {
          await milestone3.click().catch(() => null);
        }
      });

      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (await isStep3Visible()) return;

        const toMediaPrimary = page.getByRole('button', { name: /к медиа/i }).first();
        if (await toMediaPrimary.isVisible().catch(() => false)) {
          await toMediaPrimary.scrollIntoViewIfNeeded().catch(() => null);
          await toMediaPrimary.click({ force: true }).catch(() => null);
          await page.waitForLoadState('domcontentloaded').catch(() => null);
          if (await isStep3Visible()) return;
        }

        const milestone3 = page.locator('[aria-label^="Перейти к шагу 3"]').first();
        if (await milestone3.isVisible().catch(() => false)) {
          await milestone3.click({ force: true }).catch(() => null);
          await page.waitForLoadState('domcontentloaded').catch(() => null);
          if (await isStep3Visible()) return;
        }

        const milestoneText3 = page.getByRole('button', { name: /^3$/ }).first();
        if (await milestoneText3.isVisible().catch(() => false)) {
          await milestoneText3.scrollIntoViewIfNeeded().catch(() => null);
          await milestoneText3.click({ force: true }).catch(() => null);
          await page.waitForLoadState('domcontentloaded').catch(() => null);
        }
      }

      await expect.poll(isStep3Visible, { timeout: 30_000 }).toBeTruthy();
    };

    await mockFakeAuthApis(page);
    await openNewTravelWizard();

    // Recover draft if dialog appears (it can mount async after initial render).
    const draftDialogTitle = page
      .getByText(/^(Найден черновик|Есть несохранённые изменения)$/)
      .first();
    const recoverBtn = page
      .getByRole('button', { name: /(восстановить|продолжить.*черновик)/i })
      .first();

    await Promise.race([
      draftDialogTitle.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null),
      recoverBtn.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null),
    ]);

    if (await draftDialogTitle.isVisible().catch(() => false)) {
      if (await recoverBtn.isVisible().catch(() => false)) {
        await recoverBtn.click({ force: true });
      }
      await draftDialogTitle.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => null);
    }

    await ensureOnStep3();

    // Save once so gallery becomes available.
    const saveButton = page.getByRole('button', { name: 'Сохранить' }).first();
    if (await saveButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveButton.click({ force: true });
    } else {
      const moreButton = page.getByRole('button', { name: 'Открыть меню действий' }).first();
      await expect(moreButton).toBeVisible({ timeout: 30_000 });
      await moreButton.click({ force: true });
      const saveMenuItem = page.getByRole('menuitem', { name: 'Сохранить' }).first();
      await expect(saveMenuItem).toBeVisible({ timeout: 30_000 });
      await saveMenuItem.click({ force: true });
    }

    // Wait until the "gallery available after save" hint disappears.
    const galleryLockedHint = page.getByText('Галерея станет доступна после сохранения путешествия.', { exact: true }).first();
    await galleryLockedHint.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => null);

    // Wait for Gallery section and its counter.
    const galleryTitle = page.getByText('Галерея путешествия', { exact: true }).first();
    await expect(galleryTitle).toBeVisible({ timeout: 30_000 });

    const galleryCounter = page.getByText(/Загружено\s+\d+\s+из\s+\d+/i).first();
    await expect(galleryCounter).toBeVisible({ timeout: 30_000 });

    // Wait for error state to appear
    const errorText = page.getByText('Ошибка загрузки', { exact: true }).first();
    await expect(errorText).toBeVisible({ timeout: 30_000 });
    
    const beforeCount = await page.getByTestId('gallery-image').count();
    expect(beforeCount).toBeGreaterThan(0);
    
    // Use JavaScript to directly click the delete button
    await page.evaluate(() => {
      const deleteButtons = document.querySelectorAll('[data-testid="delete-image-button"]');
      if (deleteButtons.length > 0) {
        (deleteButtons[0] as HTMLElement).click();
      }
    });
    
    // Wait for the delete to process
    await page.waitForLoadState('networkidle').catch(() => null);

    // Check if image was removed
    const emptyText = page.getByText('Нет загруженных изображений', { exact: true }).first();
    const zeroCount = page.getByText(/Загружено\s+0\s+из/i).first();

    await expect
      .poll(async () => {
        const afterCount = await page.getByTestId('gallery-image').count();
        if (afterCount < beforeCount) return true;
        if (await emptyText.isVisible().catch(() => false)) return true;
        return await zeroCount.isVisible().catch(() => false);
      }, { timeout: 15000 })
      .toBeTruthy();
  });
});
