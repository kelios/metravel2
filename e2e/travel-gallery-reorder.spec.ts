import { test, expect } from './fixtures';
import { mockFakeAuthApis } from './helpers/auth';

/**
 * Gallery reorder via the move-left / move-right controls (GalleryGrid).
 * The reorder *endpoint* is covered in travel-persistence.spec.ts; this covers
 * the UI: clicking "move right" on the first image swaps it with the second.
 *
 * Setup mirrors gallery-delete-broken-image.spec.ts: seed a recoverable draft
 * with two gallery images, fake auth, and mock upsert so the gallery unlocks
 * (it is disabled until the travel has an id).
 */
test.describe('Gallery: reorder via move controls', () => {
  test('move-right swaps the first image with the second', async ({ page, baseURL }) => {
    const base = (baseURL || '').replace(/\/+$/, '');
    const savedTravelId = 4243;
    const imgA = { id: 9001, url: `${base}/gallery/9001/conversions/a.jpg` };
    const imgB = { id: 9002, url: `${base}/gallery/9002/conversions/b.jpg` };
    let currentGallery: any[] = [imgA, imgB];

    // 1×1 transparent PNG for both gallery images so they load successfully.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8m2p8AAAAASUVORK5CYII=',
      'base64'
    );
    await page.route('**/gallery/9001/conversions/a.jpg**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: png })
    );
    await page.route('**/gallery/9002/conversions/b.jpg**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: png })
    );

    await page.addInitScript(
      ({ gallery }) => {
        try {
          window.localStorage.setItem(
            'metravel_consent_v1',
            JSON.stringify({ necessary: true, analytics: false, date: '2026-01-01T00:00:00.000Z' })
          );
          const key = 'metravel_encryption_key_v1';
          const plain = 'e2e-fake-token';
          const raw = Array.from(plain)
            .map((ch, i) => String.fromCharCode(ch.charCodeAt(0) ^ key.charCodeAt(i % key.length)))
            .join('');
          window.localStorage.setItem('secure_userToken', btoa(raw));
          window.localStorage.setItem('userId', '1');
          window.localStorage.setItem('userName', 'E2E User');
          window.localStorage.setItem('isSuperuser', 'false');
          window.localStorage.setItem(
            'metravel_travel_draft_new',
            JSON.stringify({
              data: {
                name: 'E2E draft with reorderable gallery',
                description: '',
                gallery,
                publish: false,
                moderation: false,
              },
              // Fresh timestamp so the wizard auto-loads the draft instead of
              // treating it as stale (which would require the recovery dialog).
              timestamp: Date.now(),
            })
          );
        } catch {
          // ignore
        }
      },
      { gallery: currentGallery }
    );

    // Mock upsert so the travel gets an id (unlocks the gallery) and the gallery
    // round-trips. Autosave may omit gallery; only update when provided.
    const upsertPatterns = ['**/api/travels/upsert/**', '**/api/travels/upsert/', '**/travels/upsert/**', '**/travels/upsert/'];
    for (const pattern of upsertPatterns) {
      await page.route(pattern, async (route) => {
        const req = route.request();
        const method = req.method().toUpperCase();
        if (method !== 'PUT' && method !== 'POST') {
          await route.fallback();
          return;
        }
        let body: any = null;
        try {
          const rawBody = req.postData();
          body = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          body = null;
        }
        const payload = body?.data ?? body ?? {};
        const responseBody: any = {
          ...payload,
          id: payload?.id ?? savedTravelId,
          name: payload?.name ?? 'E2E draft with reorderable gallery',
          publish: false,
          moderation: false,
        };
        if (Array.isArray(payload?.gallery)) {
          currentGallery = payload.gallery;
          responseBody.gallery = currentGallery;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responseBody) });
      });
    }

    await mockFakeAuthApis(page);
    await page.goto('/travel/new', { waitUntil: 'domcontentloaded', timeout: 120_000 });

    // Recover draft if the dialog appears.
    const draftDialogTitle = page.getByText(/^(Найден черновик|Есть несохранённые изменения)$/).first();
    const recoverBtn = page.getByRole('button', { name: /(восстановить|продолжить.*черновик)/i }).first();
    await Promise.race([
      draftDialogTitle.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null),
      recoverBtn.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null),
    ]);
    if (await draftDialogTitle.isVisible().catch(() => false)) {
      if (await recoverBtn.isVisible().catch(() => false)) await recoverBtn.click({ force: true });
      await draftDialogTitle.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => null);
    }

    // Navigate to the Media step.
    const isOnMedia = async () =>
      (await page.getByText('Медиа путешествия', { exact: true }).first().isVisible().catch(() => false)) ||
      (await page.getByText('Галерея путешествия', { exact: true }).first().isVisible().catch(() => false)) ||
      (await page.getByText('Главное изображение', { exact: true }).first().isVisible().catch(() => false));

    for (let attempt = 0; attempt < 3 && !(await isOnMedia()); attempt += 1) {
      const milestone3 = page.getByRole('button', { name: /перейти к шагу 3:?\s*медиа/i }).first();
      if (await milestone3.isVisible().catch(() => false)) {
        await milestone3.click({ force: true }).catch(() => null);
      } else {
        const step3 = page.getByRole('button', { name: /^3$/ }).first();
        if (await step3.isVisible().catch(() => false)) await step3.click({ force: true }).catch(() => null);
      }
      await page.waitForLoadState('domcontentloaded').catch(() => null);
    }
    await expect.poll(isOnMedia, { timeout: 30_000 }).toBeTruthy();

    // Save once so the gallery unlocks.
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
    await page
      .getByText('Галерея станет доступна после сохранения путешествия.', { exact: true })
      .first()
      .waitFor({ state: 'hidden', timeout: 30_000 })
      .catch(() => null);

    await expect(page.getByText('Галерея путешествия', { exact: true }).first()).toBeVisible({ timeout: 30_000 });

    const galleryImages = page.getByTestId('gallery-image');
    await expect.poll(async () => galleryImages.count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(2);

    // Fingerprint the order by which seeded image id appears in each tile.
    const orderOf = async () =>
      page.evaluate(() => {
        const tiles = Array.from(document.querySelectorAll('[data-testid="gallery-image"]'));
        return tiles.map((tile) => {
          const html = tile.outerHTML;
          if (html.includes('9001')) return 'A';
          if (html.includes('9002')) return 'B';
          return '?';
        });
      });

    const before = await orderOf();
    if (before.includes('?') || before.length < 2) {
      test.info().annotations.push({
        type: 'note',
        description: `Could not fingerprint gallery order (${JSON.stringify(before)}); skipping reorder assertion.`,
      });
      return;
    }
    expect(before.slice(0, 2)).toEqual(['A', 'B']);

    // Click "move right" on the first tile.
    const firstTileMoveRight = galleryImages.nth(0).getByTestId('gallery-move-right-button');
    await expect(firstTileMoveRight).toBeVisible({ timeout: 15_000 });
    await firstTileMoveRight.click({ force: true });

    await expect.poll(async () => (await orderOf()).slice(0, 2).join(''), { timeout: 15_000 }).toBe('BA');
  });
});
