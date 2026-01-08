import { test, expect } from '@playwright/test';
import { apiLogin, createOrUpdateTravel, deleteTravel } from './helpers/e2eApi';

test.describe('Draft recovery popup', () => {
  test('appears only on page open when stale draft exists and does not reappear on autosave', async ({ page }) => {
    const email = (process.env.E2E_EMAIL || '').trim();
    const password = (process.env.E2E_PASSWORD || '').trim();
    const hasCreds = !!email && !!password;

    const apiBase = (process.env.E2E_API_URL || '').trim().replace(/\/+$/, '');
    const appApiBase = (process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
    const canSeedViaApi = hasCreds && !!apiBase && (!appApiBase || appApiBase === apiBase);

    if (!canSeedViaApi) {
      test.info().annotations.push({
        type: 'note',
        description:
          'E2E_API_URL/E2E_EMAIL/E2E_PASSWORD not configured or API base mismatch; running a minimal smoke instead',
      });
      await page.goto('/travelsby', { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await expect(page.locator('body')).toBeVisible();
      await expect(page).not.toHaveURL(/\/login/);
      return;
    }

    const apiCtx = await apiLogin(email, password);

    const uniqueSuffix = `${Date.now()}`;
    const created = await createOrUpdateTravel(apiCtx, {
      id: null,
      name: `E2E Draft Recovery ${uniqueSuffix}`,
      description:
        'Autotest draft recovery travel description long enough to pass validation and allow stable editor load.',
      countries: [],
      cities: [],
      over_nights_stay: [],
      complexity: [],
      companions: [],
      recommendation: null,
      plus: null,
      minus: null,
      youtube_link: null,
      gallery: [],
      categories: [],
      countryIds: [],
      travelAddressIds: [],
      travelAddressCity: [],
      travelAddressCountry: [],
      travelAddressAdress: [],
      travelAddressCategory: [],
      coordsMeTravel: [],
      thumbs200ForCollectionArr: [],
      travelImageThumbUrlArr: [],
      travelImageAddress: [],
      categoriesIds: [],
      transports: [],
      month: [],
      year: '2026',
      budget: '',
      number_peoples: '2',
      number_days: '3',
      visa: false,
      publish: false,
      moderation: false,
    });

    const travelId = String(created?.id ?? '').trim();
    expect(travelId, 'Upsert did not return id').toBeTruthy();
    const draftKey = `metravel_travel_draft_${travelId}`;

    // Pre-accept cookies and pre-seed a draft before page scripts run.
    await page.addInitScript((key: string) => {
      try {
        window.localStorage.setItem(
          'metravel_consent_v1',
          JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() })
        );

        window.localStorage.setItem(
          key,
          JSON.stringify({ data: { name: 'stale draft' }, timestamp: Date.now() - 60_000 })
        );
      } catch {
        // ignore
      }
    }, draftKey);

    try {
      await page.goto(`/travel/${travelId}/`, { waitUntil: 'domcontentloaded' });

      // Draft recovery modal should appear on open.
      await expect(page.getByText('Найден черновик', { exact: true })).toBeVisible({ timeout: 30_000 });

      // Dismiss and continue with clean slate.
      await page.getByRole('button', { name: 'Начать заново' }).click({ timeout: 20_000 });
      await expect(page.getByText('Найден черновик', { exact: true })).toHaveCount(0);

      // Edit a field to trigger autosave + draft save in the background.
      const nameCandidates = [
        page.getByRole('textbox', { name: /Название путешествия/i }).first(),
        page.locator('input[placeholder*="Название" i]').first(),
        page.locator('input[name*="name" i]').first(),
        page.locator('input').first(),
      ];

      let nameBox: any = null;
      for (const c of nameCandidates) {
        if (await c.isVisible().catch(() => false)) {
          nameBox = c;
          break;
        }
      }
      if (!nameBox) {
        await Promise.race(
          nameCandidates.map((c) => c.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null))
        );
        for (const c of nameCandidates) {
          if (await c.isVisible().catch(() => false)) {
            nameBox = c;
            break;
          }
        }
      }

      expect(nameBox, 'Travel name input should be visible').toBeTruthy();
      await nameBox.click({ timeout: 20_000 });
      await nameBox.fill('Autotest name');

      // Wait long enough for debounce-based draft save + autosave to occur.
      await page.waitForTimeout(8_000);

      // Popup must not reappear due to autosave.
      await expect(page.getByText('Найден черновик', { exact: true })).toHaveCount(0);

      // Manual save should clear the local draft. Click the save action in the header.
      await page.getByRole('button', { name: 'Сохранить' }).click({ timeout: 20_000 });
      await page.waitForTimeout(1500);

      // After reload, the draft popup should not appear again.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Найден черновик', { exact: true })).toHaveCount(0);
    } finally {
      await deleteTravel(apiCtx, travelId);
    }
  });
});
