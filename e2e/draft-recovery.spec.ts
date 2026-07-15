import { test, expect } from './fixtures';
import { apiLogin, createOrUpdateTravel, deleteTravel } from './helpers/e2eApi';
import { mockFakeAuthApis } from './helpers/auth';

test.describe('Draft recovery popup', () => {
  test('appears only on page open when stale draft exists and does not reappear on autosave', async ({ page }) => {
    const email = (process.env.E2E_EMAIL || '').trim();
    const password = (process.env.E2E_PASSWORD || '').trim();
    const hasCreds = !!email && !!password;

    const apiBase = (process.env.E2E_API_URL || '').trim().replace(/\/+$/, '');
    const appApiBase = (process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
    const canSeedViaApi = hasCreds && !!apiBase && (!appApiBase || appApiBase === apiBase);

    expect(
      canSeedViaApi,
      'Draft recovery live-contract requires E2E_EMAIL/E2E_PASSWORD and matching E2E_API_URL',
    ).toBe(true);
    if (!canSeedViaApi) throw new Error('Live-contract API credentials or API base are unavailable');

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
      travelImageThumbUrArr: [],
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

    // Ensure the editor route does not redirect as a guest in full-suite runs.
    // Prefer the real API token (store plaintext; secureStorage falls back to raw value if decryption fails).
    const tokenToStore = String(apiCtx?.token || 'e2e-fake-token');
    const userIdToStore = String(apiCtx?.userId || '').trim() || '1';
    await page.addInitScript((payload: { token: string }) => {
      try {
        window.localStorage.setItem('secure_userToken', payload.token);
        window.localStorage.setItem('userId', (payload as any).userId);
        window.localStorage.setItem('userName', 'E2E User');
        window.localStorage.setItem('isSuperuser', 'false');
      } catch {
        // ignore
      }
    }, { token: tokenToStore, userId: userIdToStore } as any);

    // Prevent auth hydration from invalidating our seeded token (profile/refresh can 401 and log out).
    await mockFakeAuthApis(page);

    try {
      // Draft recovery is implemented in the travel editor (UpsertTravelView), routed as /travel/:id.
      await page.goto(`/travel/${travelId}`, { waitUntil: 'domcontentloaded' });

      const landedUrl = page.url();
      const landedPath = (() => {
        try {
          return new URL(landedUrl).pathname;
        } catch {
          return '';
        }
      })();

      expect(
        landedPath,
        `Expected editor /travel/${travelId}, got ${landedPath || landedUrl}`,
      ).toContain(`/travel/${travelId}`);

      // Ensure we're not stuck on Home/Login due to auth or routing issues.
      await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 30_000 });
      await expect(page).not.toHaveURL(/\/$/, { timeout: 30_000 });

      // Give the editor a moment to mount; different builds can render different testIDs.
      await page.waitForLoadState('domcontentloaded').catch(() => null);

      // Confirm our seeded draft is present after navigation.
      const hasDraftKey = await page
        .evaluate((key: string) => {
          try {
            return window.localStorage.getItem(key) != null;
          } catch {
            return false;
          }
        }, draftKey)
        .catch(() => false);

      expect(hasDraftKey, `Expected draft key ${draftKey} to exist in localStorage`).toBeTruthy();

      // Draft recovery modal should appear on open.
      // Title from DraftRecoveryDialog.tsx line 67: 'Есть несохранённые изменения'
      // a11y label: accessibilityLabel="Найден локальный черновик" (accessibilityRole="alert")
      // In some environments the editor route can still redirect (e.g., access checks); in that case
      // don't fail the whole suite with a long timeout.
      const draftTitle = page.getByText('Есть несохранённые изменения', { exact: true });
      const homeHeadline = page.getByText('Пиши о своих путешествиях', { exact: true });
      const loginTitle = page.getByText('Войти', { exact: true });
      const noAccess = page.getByText('Нет доступа', { exact: true });
      const loadError = page.getByText(/не удалось загрузить путешествие|ошибка загрузки/i).first();

      await Promise.race([
        draftTitle.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null),
        homeHeadline.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null),
        loginTitle.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null),
        noAccess.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null),
        loadError.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null),
      ]);

      await expect(homeHeadline, 'Editor unexpectedly redirected home').toBeHidden();
      await expect(loginTitle, 'Editor unexpectedly redirected to login').toBeHidden();
      await expect(noAccess, 'Owner unexpectedly received a no-access screen').toBeHidden();
      await expect(loadError, 'Editor failed to load the seeded travel').toBeHidden();

      // Hard assert: if we are on the editor with a seeded draft, the dialog MUST appear.
      await draftTitle.waitFor({ state: 'visible', timeout: 15_000 });
      await expect(draftTitle).toBeVisible();

      // Dismiss and continue with clean slate.
      // Button label from DraftRecoveryDialog.tsx: 'Открыть сохранённую' (onDiscard path)
      await page.getByRole('button', { name: 'Открыть сохранённую' }).click({ timeout: 20_000 });
      await expect(page.getByText('Есть несохранённые изменения', { exact: true })).toHaveCount(0);

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
      await expect(page.getByText('Есть несохранённые изменения', { exact: true })).toHaveCount(0);

      // Manual save should clear the local draft.
      // 'Сохранить' lives inside the "⋯" header menu (TravelWizardHeader.tsx),
      // and also appears as 'Сохранить путешествие' in the Quill editor toolbar.
      // Try both: open the more-menu first, then fall back to the toolbar button.
      const moreMenuBtn = page.getByRole('button', { name: /Открыть меню действий/i })
      const saveInMenu = page.getByRole('menuitem', { name: /^Сохранить$/i }).or(
        page.getByRole('button', { name: /^Сохранить$/i })
      ).first()
      const saveInToolbar = page.getByRole('button', { name: /Сохранить путешествие/i })

      const moreVisible = await moreMenuBtn.isVisible().catch(() => false)
      if (moreVisible) {
        await moreMenuBtn.click({ timeout: 10_000 })
        const menuSave = page.getByText('Сохранить', { exact: true })
        const toolbarSave = saveInToolbar
        await Promise.race([
          menuSave.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => null),
          toolbarSave.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => null),
        ])
        if (await menuSave.isVisible().catch(() => false)) {
          await menuSave.click({ timeout: 10_000 })
        } else if (await toolbarSave.isVisible().catch(() => false)) {
          await toolbarSave.click({ timeout: 10_000 })
        } else {
          await saveInMenu.click({ timeout: 10_000 })
        }
      } else {
        await saveInToolbar.click({ timeout: 20_000 })
      }

      // Ensure no beforeunload warning blocks reload after save.
      const dialogs: string[] = [];
      page.on('dialog', async (dialog) => {
        dialogs.push(dialog.type());
        await dialog.dismiss().catch(() => undefined);
      });

      // Immediately reload: this reproduces the real user behavior (click save -> reload right away).
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Есть несохранённые изменения', { exact: true })).toHaveCount(0);

      expect(dialogs, 'Reload after save should not trigger a dialog (beforeunload)').toEqual([]);
    } finally {
      await deleteTravel(apiCtx, travelId);
    }
  });
});
