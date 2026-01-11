import { test, expect } from './fixtures';

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

    await page.goto('/travel/new', { waitUntil: 'domcontentloaded', timeout: 120_000 });

    // Recover draft if dialog appears (it can mount async after initial render).
    const draftDialogTitle = page.getByText('Найден черновик', { exact: true }).first();
    const recoverBtn = page.getByRole('button', { name: /восстановить/i }).first();

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

    // Navigate to Media step.
    const waitForMediaStep = async (timeout: number) => {
      await Promise.race([
        page.getByText('Медиа путешествия', { exact: true }).first().waitFor({ state: 'visible', timeout }).catch(() => null),
        page.getByText('Галерея путешествия', { exact: true }).first().waitFor({ state: 'visible', timeout }).catch(() => null),
        page.getByText('Главное изображение', { exact: true }).first().waitFor({ state: 'visible', timeout }).catch(() => null),
      ]);
    };

    await waitForMediaStep(5000).catch(() => null);

    for (let attempt = 0; attempt < 3; attempt++) {
      const isOnMedia =
        (await page.getByText('Медиа путешествия', { exact: true }).first().isVisible().catch(() => false)) ||
        (await page.getByText('Галерея путешествия', { exact: true }).first().isVisible().catch(() => false)) ||
        (await page.getByText('Главное изображение', { exact: true }).first().isVisible().catch(() => false));
      if (isOnMedia) break;

      const milestone3 = page.locator('[aria-label="Перейти к шагу 3"]').first();
      if (await milestone3.isVisible().catch(() => false)) {
        await milestone3.click({ force: true }).catch(() => null);
        await page.waitForTimeout(700);
        continue;
      }

      const step3TextButton = page.getByRole('button', { name: /^3$/ }).first();
      if (await step3TextButton.isVisible().catch(() => false)) {
        await step3TextButton.click({ force: true }).catch(() => null);
        await page.waitForTimeout(700);
      }
    }

    await expect
      .poll(
        async () => {
          if (await page.getByText('Медиа путешествия', { exact: true }).first().isVisible().catch(() => false)) return true;
          if (await page.getByText('Галерея путешествия', { exact: true }).first().isVisible().catch(() => false)) return true;
          return await page.getByText('Главное изображение', { exact: true }).first().isVisible().catch(() => false);
        },
        { timeout: 30_000 }
      )
      .toBeTruthy();

    // Save once so gallery becomes available.
    const saveButton = page.getByRole('button', { name: 'Сохранить' }).first();
    await expect(saveButton).toBeVisible({ timeout: 30_000 });
    await saveButton.click({ force: true });

    // Wait until the "gallery available after save" hint disappears.
    const galleryLockedHint = page.getByText('Галерея станет доступна после сохранения путешествия.', { exact: true }).first();
    await galleryLockedHint.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => null);

    // Wait for Gallery section and its counter.
    const galleryTitle = page.getByText('Галерея путешествия', { exact: true }).first();
    await expect(galleryTitle).toBeVisible({ timeout: 30_000 });

    const galleryCounter = page.getByText(/Загружено\s+\d+\s+из\s+\d+/i).first();
    await expect(galleryCounter).toBeVisible({ timeout: 30_000 });

    // Click delete action inside Gallery - use the "Удалить" button in error overlay.
    const deleteButton = page.getByRole('button', { name: 'Удалить' }).first();
    await expect(deleteButton).toBeVisible({ timeout: 30_000 });
    await deleteButton.click({ force: true });

    // Assert that handler was invoked (set by the app on web).
    await expect
      .poll(async () => {
        return await page
          .evaluate(() => {
            try {
              return Boolean((globalThis as any).__e2e_last_gallery_delete);
            } catch {
              return false;
            }
          })
          .catch(() => false);
      })
      .toBeTruthy();

    const emptyText = page.getByText('Нет загруженных изображений', { exact: true }).first();
    const zeroCount = page.getByText(/Загружено\s+0\s+из/i).first();

    await expect
      .poll(async () => {
        if (await emptyText.isVisible().catch(() => false)) return true;
        return await zeroCount.isVisible().catch(() => false);
      })
      .toBeTruthy();
  });
});
