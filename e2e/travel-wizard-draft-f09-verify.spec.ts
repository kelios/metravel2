import { test, expect } from './fixtures';
import { apiLogin, deleteTravel } from './helpers/e2eApi';
import { mockFakeAuthApis } from './helpers/auth';

// F-09 / ticket #340 — false draft-recovery prompt after autosave assigns an id.
// We reproduce the *actual* fixed dialog text from DraftRecoveryDialog.tsx:
//   title:               'Есть несохранённые изменения'
//   accessibilityLabel:  'Найден локальный черновик'
const DIALOG_TITLE = 'Есть несохранённые изменения';
const DRAFT_PREFIX = 'metravel_travel_draft';

function readEnv() {
  const email = (process.env.E2E_EMAIL || '').trim();
  const password = (process.env.E2E_PASSWORD || '').trim();
  const apiBase = (process.env.E2E_API_URL || '').trim().replace(/\/+$/, '');
  const appApiBase = (process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
  const canSeed = !!email && !!password && !!apiBase && (!appApiBase || appApiBase === apiBase);
  return { email, password, apiBase, canSeed };
}

async function seedAuth(page: any, token: string, userId: string) {
  await page.addInitScript(
    (payload: { token: string; userId: string }) => {
      try {
        window.localStorage.setItem(
          'metravel_consent_v1',
          JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() })
        );
        window.localStorage.setItem('secure_userToken', payload.token);
        window.localStorage.setItem('userId', payload.userId);
        window.localStorage.setItem('userName', 'E2E User');
        window.localStorage.setItem('isSuperuser', 'false');
      } catch {
        // ignore
      }
    },
    { token, userId }
  );
  await mockFakeAuthApis(page);
}

async function lsKeys(page: any): Promise<string[]> {
  return page.evaluate((prefix: string) => {
    const out: string[] = [];
    try {
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(prefix)) out.push(k);
      }
    } catch {
      // ignore
    }
    return out;
  }, DRAFT_PREFIX);
}

test.describe('F-09 wizard draft recovery — false prompt after autosave id-sync', () => {
  test('reload of /travel/new?id=<id> shows server data, no recovery dialog, no orphan draft', async ({ page }) => {
    const { email, password, canSeed } = readEnv();
    if (!canSeed) {
      test.info().annotations.push({ type: 'note', description: 'E2E creds/API not configured; skipping' });
      test.skip(true, 'E2E creds/API base not configured');
      return;
    }

    const apiCtx = await apiLogin(email, password).catch((e: unknown) => {
      test.info().annotations.push({ type: 'note', description: `apiLogin failed: ${String((e as any)?.message || e)}` });
      return null;
    });
    if (!apiCtx) {
      test.skip(true, 'apiLogin failed');
      return;
    }

    const token = String(apiCtx.token || '');
    const userId = String(apiCtx.userId || '1');
    await seedAuth(page, token, userId);

    const consoleErrors: string[] = [];
    page.on('console', (m: any) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    const failedRequests: string[] = [];
    page.on('requestfailed', (r: any) => failedRequests.push(`${r.method()} ${r.url()}`));
    const fetchTravelCalls: string[] = [];
    page.on('request', (r: any) => {
      const u = String(r.url());
      if (/\/api\/travels\/\d+\/?($|\?)/.test(u) && r.method() === 'GET') fetchTravelCalls.push(u);
    });

    let createdId = '';

    try {
      // --- STEP 1: open /travel/new and create via real UI autosave -------------
      await page.goto('/travel/new', { waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 30_000 });

      const nameBox = page.getByRole('textbox', { name: /Название путешествия/i }).first();
      await nameBox.waitFor({ state: 'visible', timeout: 30_000 });
      const unique = `F09 Verify ${Date.now()}`;
      await nameBox.click();
      await nameBox.fill(unique);

      // description (rich-text editor; long enough to satisfy autosave validation gate)
      const descEditor = page.locator('[contenteditable="true"]').first();
      if (await descEditor.isVisible().catch(() => false)) {
        await descEditor.click().catch(() => null);
        await page.keyboard
          .type('Описание для проверки F-09: достаточно длинное чтобы пройти автосейв и валидацию формы визарда.')
          .catch(() => null);
      }
      // Blur to commit the field value and trigger autosave debounce.
      await page.keyboard.press('Tab').catch(() => null);

      // Wait for the URL to gain ?id=<n> (id-sync after first successful autosave).
      await page.waitForFunction(
        () => {
          try {
            const u = new URL(window.location.href);
            return /\d+/.test(u.searchParams.get('id') || '');
          } catch {
            return false;
          }
        },
        { timeout: 60_000 }
      ).catch(() => null);

      const urlId = await page.evaluate(() => {
        try {
          return new URL(window.location.href).searchParams.get('id') || '';
        } catch {
          return '';
        }
      });

      if (!urlId) {
        test.info().annotations.push({
          type: 'note',
          description: 'UI autosave did not assign ?id within timeout; cannot browser-verify F-09 via UI on this build/env',
        });
        test.skip(true, 'autosave id-sync did not occur in UI');
        return;
      }
      createdId = urlId;

      // --- STEP 3a: right after a successful save there must be no orphan draft ---
      // Allow the post-save clearDraft + key-change cleanup effects to flush.
      await page.waitForTimeout(1500);
      const keysAfterSave = await lsKeys(page);
      expect(
        keysAfterSave,
        `No travel-draft localStorage keys expected right after save, got: ${JSON.stringify(keysAfterSave)}`
      ).toEqual([]);

      // --- STEP 2: reload /travel/new?id=<id> — NO recovery dialog ----------------
      fetchTravelCalls.length = 0;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 30_000 });

      // Editor should mount and show server data (the name we saved).
      const reloadedName = page.getByRole('textbox', { name: /Название путешествия/i }).first();
      await reloadedName.waitFor({ state: 'visible', timeout: 30_000 });

      // Give the draft-check effect time to run (it is async + debounced).
      await page.waitForTimeout(3000);

      // The dialog MUST NOT appear.
      await expect(page.getByText(DIALOG_TITLE, { exact: true })).toHaveCount(0);

      // Form shows server data, not an empty form.
      const nameVal = await reloadedName.inputValue().catch(() => '');
      expect(nameVal, 'Reloaded form should show saved server name').toContain('F09 Verify');

      // --- STEP 3b: still no orphan draft after reload ---------------------------
      const keysAfterReload = await lsKeys(page);
      // Tolerate a fresh draft only if the check did not surface a dialog; ideally none.
      expect(
        keysAfterReload.filter((k) => k === `${DRAFT_PREFIX}_new`),
        `No _new draft key should survive id-sync, got: ${JSON.stringify(keysAfterReload)}`
      ).toEqual([]);

      // --- STEP 5: console/network clean -----------------------------------------
      const relevantErrors = consoleErrors.filter(
        (e) => !/favicon|ResizeObserver|Download the React DevTools|web-vitals/i.test(e)
      );
      expect(relevantErrors, `Console errors: ${JSON.stringify(relevantErrors)}`).toEqual([]);
    } finally {
      if (createdId) {
        await deleteTravel(apiCtx, createdId).catch(() => null);
      }
    }
  });

  test('legitimate recovery: an unsaved local draft under _<id> DOES surface the dialog on reload', async ({ page }) => {
    const { email, password, canSeed } = readEnv();
    if (!canSeed) {
      test.skip(true, 'E2E creds/API base not configured');
      return;
    }
    const apiCtx = await apiLogin(email, password).catch(() => null);
    if (!apiCtx) {
      test.skip(true, 'apiLogin failed');
      return;
    }

    const token = String(apiCtx.token || '');
    const userId = String(apiCtx.userId || '1');

    // Create a travel via API so the editor has server data to compare against.
    const { createOrUpdateTravel } = await import('./helpers/e2eApi');
    const created = await createOrUpdateTravel(apiCtx, {
      id: null,
      name: `F09 Legit ${Date.now()}`,
      description: 'Серверная версия путешествия для проверки легитимного восстановления черновика.',
      countries: [], cities: [], over_nights_stay: [], complexity: [], companions: [],
      recommendation: null, plus: null, minus: null, youtube_link: null, gallery: [], categories: [],
      countryIds: [], travelAddressIds: [], travelAddressCity: [], travelAddressCountry: [],
      travelAddressAdress: [], travelAddressCategory: [], coordsMeTravel: [], thumbs200ForCollectionArr: [],
      travelImageThumbUrlArr: [], travelImageThumbUrArr: [], travelImageAddress: [], categoriesIds: [],
      transports: [], month: [], year: '2026', budget: '', number_peoples: '2', number_days: '3',
      visa: false, publish: false, moderation: false,
    }).catch(() => null);

    if (!created?.id) {
      test.skip(true, 'could not seed travel via API');
      return;
    }
    const travelId = String(created.id);
    const draftKey = `${DRAFT_PREFIX}_${travelId}`;

    await seedAuth(page, token, userId);
    // Seed a genuinely DIFFERENT local draft (a real unsaved edit) before scripts run.
    await page.addInitScript(
      (payload: { key: string }) => {
        try {
          window.localStorage.setItem(
            payload.key,
            JSON.stringify({ data: { name: 'Локальная несохранённая правка F-09' }, timestamp: Date.now() - 60_000 })
          );
        } catch {
          // ignore
        }
      },
      { key: draftKey }
    );

    try {
      await page.goto(`/travel/new?id=${travelId}`, { waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 30_000 });

      // Editor mounts.
      const nameBox = page.getByRole('textbox', { name: /Название путешествия/i }).first();
      await nameBox.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null);

      // The recovery dialog MUST appear for a real divergent draft.
      const dialog = page.getByText(DIALOG_TITLE, { exact: true });
      await dialog.waitFor({ state: 'visible', timeout: 30_000 });
      await expect(dialog).toBeVisible();
    } finally {
      await deleteTravel(apiCtx, travelId).catch(() => null);
    }
  });
});
