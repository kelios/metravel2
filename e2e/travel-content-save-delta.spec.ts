import { test, expect, type Page, type Response as PWResponse } from '@playwright/test';
import { apiLogin, readTravel, type E2EApiContext } from './helpers/e2eApi';
import { mockFakeAuthApis } from './helpers/auth';

/**
 * #1516 — permanent regression: background autosave of a text-only edit must
 * go through the narrow `PATCH /travels/{id}/content/` (#1513) instead of the
 * full `PUT /travels/upsert/`, and must leave the article's structure
 * (route points, gallery, reference lists, publish status) byte-identical.
 *
 * Live-contract spec: it edits a real, test-owned article via the real local
 * backend (see scripts/e2e-suite-classification.js). Not part of the default
 * suite. Run with:
 *   E2E_SUITE=live-contract E2E_API_URL=http://localhost:8000 \
 *   EXPO_PUBLIC_API_URL=http://localhost:8000 E2E_ALLOW_LIVE_MUTATIONS=1 \
 *   E2E_NO_WEBSERVER=1 BASE_URL=http://localhost:8081 \
 *   npx playwright test e2e/travel-content-save-delta.spec.ts --project=chromium
 *
 * BASE_URL must be the `localhost` origin, not `127.0.0.1`: the local Django
 * backend's `CORS_ALLOWED_ORIGINS` (metravel-backend/metravel/envs/local/
 * settings.py) explicitly allows `http://localhost:8081` and a bare-IP regex
 * with no port, but not `http://127.0.0.1:8081` — that origin's fetches to
 * the backend fail as an opaque browser network error, not a 401, which reads
 * as "the wizard failed to load" rather than an obvious auth problem.
 *
 * Deliberately imports `test`/`expect` from `@playwright/test`, NOT from
 * `./fixtures`: the shared `createdTravels` fixture deletes any travel id
 * seen in a successful `/travels/upsert/` response, and the mutation probe
 * below (a temporarily broken `planTravelContentSave`) intentionally drives
 * a REAL full upsert for this same article id. That fixture would delete the
 * shared QA article (id 683) the moment the probe proves the regression —
 * this file must never depend on it.
 *
 * TRAVEL_ID is a QA-account-owned article pre-seeded with non-empty route
 * points, a gallery, country/category references and publish=false
 * specifically for this ticket. Only its description is expected to change;
 * every other field is asserted to survive the edit unchanged.
 */
const TRAVEL_ID = Number(process.env.E2E_CONTENT_SAVE_TRAVEL_ID || '683');
const NAME_PLACEHOLDER = 'Например: Неделя в Грузии';
const CONTENT_FIELD_KEYS = ['name', 'description', 'plus', 'minus', 'recommendation'];
const STRUCTURAL_KEYS = [
  'id',
  'slug',
  'coordsMeTravel',
  'gallery',
  'countries',
  'categories',
  'publish',
  'moderation',
  'youtube_link',
  'travelAddress',
];

function isContentPatchUrl(url: string): boolean {
  return url.includes(`/travels/${TRAVEL_ID}/content/`);
}

function isUpsertPutUrl(url: string): boolean {
  return url.includes('/travels/upsert/');
}

function readEnv() {
  const email = (process.env.E2E_EMAIL || '').trim();
  const password = (process.env.E2E_PASSWORD || '').trim();
  const apiBase = (process.env.E2E_API_URL || '').trim().replace(/\/+$/, '');
  const appApiBase = (process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
  const canRun = !!email && !!password && !!apiBase && (!appApiBase || appApiBase === apiBase);
  return { email, password, apiBase, canRun };
}

type StructuralSnapshot = {
  name: string;
  slug: string;
  pointIds: number[];
  pointCoords: string[];
  galleryIds: number[];
  countries: number[];
  categories: number[];
  publish: boolean;
  moderation: boolean;
};

function snapshotStructure(travel: Record<string, any>): StructuralSnapshot {
  const points = Array.isArray(travel?.travelAddress) ? travel.travelAddress : [];
  const gallery = Array.isArray(travel?.gallery) ? travel.gallery : [];
  return {
    name: String(travel?.name ?? ''),
    slug: String(travel?.slug ?? ''),
    pointIds: points.map((p: any) => p.id),
    pointCoords: points.map((p: any) => String(p.coord)),
    galleryIds: gallery.map((g: any) => g.id),
    countries: Array.isArray(travel?.countries) ? [...travel.countries] : [],
    categories: Array.isArray(travel?.categories) ? [...travel.categories] : [],
    publish: Boolean(travel?.publish),
    moderation: Boolean(travel?.moderation),
  };
}

/**
 * The desktop description editor (`ArticleEditor`) is `React.lazy`-loaded.
 * Mirrors the retry pattern already proven in
 * `e2e/article-editor-browser-actions.spec.ts` instead of inventing a new one.
 */
async function ensureDesktopEditorLoaded(page: Page) {
  const editor = page.locator('.ql-editor').first();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (await editor.isVisible().catch(() => false)) return editor;
    await page.waitForTimeout(1000);
  }
  await expect(editor, 'desktop ArticleEditor (.ql-editor) never became visible').toBeVisible({ timeout: 30_000 });
  return editor;
}

async function openWizardHydrated(page: Page, apiCtx: E2EApiContext, expectedName: string) {
  // The default global-setup storageState deliberately strips
  // `secure_userToken` and relies on an HttpOnly session cookie instead (see
  // e2e/global-setup.ts). This app's `apiClient` authenticates travel reads
  // with a bearer token from secure storage, not the session cookie, so that
  // default session renders the wizard as a guest ("Ошибка загрузки: не
  // удалось загрузить путешествие"). Seed the real bearer token directly —
  // same pattern already proven in e2e/draft-recovery.spec.ts.
  await page.addInitScript(
    (payload: { token: string; userId: string }) => {
      try {
        window.localStorage.setItem('secure_userToken', payload.token);
        window.localStorage.setItem('userId', payload.userId);
        window.localStorage.setItem('userName', 'E2E User');
        window.localStorage.setItem('isSuperuser', 'false');
      } catch {
        // ignore
      }
    },
    { token: apiCtx.token, userId: String(apiCtx.userId || '').trim() || '1' },
  );
  // Prevent auth-hydration probes (profile/refresh) from 401-ing the seeded
  // token and logging the session back out mid-navigation.
  await mockFakeAuthApis(page);

  // Defense-in-depth: a stale local draft for this id would pop the
  // "Есть несохранённые изменения" recovery dialog and block the form
  // underneath it. Clear it before any page script runs (F-09 pattern from
  // e2e/travel-wizard-draft-f09-verify.spec.ts).
  await page.addInitScript((key: string) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }, `metravel_travel_draft_${TRAVEL_ID}`);

  await page.goto(`/travel/${TRAVEL_ID}`, { waitUntil: 'domcontentloaded' });

  const nameInput = page.getByPlaceholder(NAME_PLACEHOLDER);
  // Hydration gate: the name input only shows the real value after
  // `formState.reset(finalData)` from the server load. Before that it is the
  // empty draft shape, and editing then would risk the anti-wipe path instead
  // of exercising the narrow content-save contract under test.
  await expect(nameInput, 'wizard must hydrate with the real server name before editing').toHaveValue(expectedName, {
    timeout: 30_000,
  });
  return nameInput;
}

async function runNarrowContentSaveCheck(
  page: Page,
  apiCtx: E2EApiContext,
  viewport: { width: number; height: number; label: 'desktop' | 'mobile' },
) {
  const before = await readTravel(apiCtx, TRAVEL_ID);
  const beforeStructure = snapshotStructure(before);

  const contentPatchBodies: string[] = [];
  const upsertPutUrls: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    const method = request.method();
    if (method === 'PATCH' && isContentPatchUrl(url)) {
      contentPatchBodies.push(request.postData() || '');
    }
    if (method === 'PUT' && isUpsertPutUrl(url)) {
      upsertPutUrls.push(url);
    }
  });

  // Registered before navigation so a fast save cannot race the listener.
  // Generous timeout: hydration of a lazy rich-text editor plus the 5s
  // autosave debounce can legitimately take longer than the debounce alone.
  // On the broken code path (mutation probe) this genuinely never resolves
  // and the test fails on this exact wait — that is the intended red signal.
  const patchResponsePromise = page.waitForResponse(
    (resp) => resp.request().method() === 'PATCH' && isContentPatchUrl(resp.url()),
    { timeout: 45_000 },
  );

  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const nameInput = await openWizardHydrated(page, apiCtx, beforeStructure.name);
  await expect(nameInput).toBeVisible();

  const marker = `E2E-1516-${viewport.label}-narrow-path-${Date.now()}`;
  const descriptionText = `${marker}. Narrow content-save regression check for board #1516: only text fields must change.`;

  if (viewport.label === 'mobile') {
    const mobileInput = page.getByTestId('travel-wizard.basic.description.mobile-input');
    await expect(mobileInput, 'mobile inline description input must be visible for a plain (non-rich) description').toBeVisible({
      timeout: 20_000,
    });
    await mobileInput.click();
    await mobileInput.fill(descriptionText);
    await expect(mobileInput).toHaveValue(descriptionText, { timeout: 10_000 });
  } else {
    const editor = await ensureDesktopEditorLoaded(page);
    await editor.click({ force: true });
    await editor.fill(descriptionText);
    await expect
      .poll(async () => (await editor.textContent()) || '', { timeout: 10_000 })
      .toContain(marker);
  }

  const patchResponse: PWResponse = await patchResponsePromise;
  expect(patchResponse.status(), `content PATCH did not return 200: got ${patchResponse.status()}`).toBe(200);

  // The debounce is a clean single-shot 5s timer with no maxWait and no
  // concurrent in-flight save (per #1516 implementation notes). This trailing
  // wait is a safety margin AFTER the real network event already resolved
  // above, to catch an immediate duplicate fire — it does not replace the
  // event wait itself.
  await page.waitForTimeout(3_000);

  expect(contentPatchBodies.length, 'exactly one narrow content PATCH must be sent for a single text edit').toBe(1);
  expect(upsertPutUrls.length, 'zero full upsert PUT calls are expected for a text-only edit').toBe(0);

  const patchBody = JSON.parse(contentPatchBodies[0]);
  const patchKeys = Object.keys(patchBody);
  expect(patchKeys.every((key) => CONTENT_FIELD_KEYS.includes(key)), `PATCH body has non-content keys: ${patchKeys.join(', ')}`).toBe(
    true,
  );
  for (const structuralKey of STRUCTURAL_KEYS) {
    expect(patchBody, `PATCH body must not carry structural field "${structuralKey}"`).not.toHaveProperty(structuralKey);
  }
  expect(patchKeys, 'only the edited description field should be present in the narrow payload').toEqual(['description']);
  expect(String(patchBody.description)).toContain(marker);

  const patchJson = await patchResponse.json().catch(() => null);
  expect(patchJson?.changed_fields, 'server content-save response must report description as the only changed field').toEqual([
    'description',
  ]);
  expect(String(patchJson?.description ?? '')).toContain(marker);

  const after = await readTravel(apiCtx, TRAVEL_ID);
  expect(String(after.description)).toContain(marker);
  expect(after.description).not.toBe(before.description);

  const afterStructure = snapshotStructure(after);
  expect(afterStructure.pointIds, 'route point ids must survive a text-only edit').toEqual(beforeStructure.pointIds);
  expect(afterStructure.pointCoords, 'route point coordinates must survive a text-only edit').toEqual(
    beforeStructure.pointCoords,
  );
  expect(afterStructure.galleryIds, 'gallery composition must survive a text-only edit').toEqual(beforeStructure.galleryIds);
  expect(afterStructure.countries, 'country references must survive a text-only edit').toEqual(beforeStructure.countries);
  expect(afterStructure.categories, 'category references must survive a text-only edit').toEqual(beforeStructure.categories);
  expect(afterStructure.publish, 'publish status must survive a text-only edit').toBe(beforeStructure.publish);
  expect(afterStructure.moderation, 'moderation status must survive a text-only edit').toBe(beforeStructure.moderation);
  expect(afterStructure.slug, 'slug must survive a description-only edit').toBe(beforeStructure.slug);
  expect(afterStructure.name, 'name must survive a description-only edit').toBe(beforeStructure.name);
}

test.describe('#1516 travel content-save narrow path (live-contract)', () => {
  test.describe.configure({ mode: 'serial' });

  const { email, password, canRun } = readEnv();
  let apiCtx: E2EApiContext;

  test.beforeAll(async () => {
    expect(
      canRun,
      'requires E2E_EMAIL/E2E_PASSWORD and E2E_API_URL matching EXPO_PUBLIC_API_URL (see docs/TESTING.md > Playwright suite safety)',
    ).toBe(true);
    apiCtx = await apiLogin(email, password);
  });

  test('desktop 1440x900: editing only the description sends one narrow content PATCH', async ({ page }) => {
    test.setTimeout(120_000);
    await runNarrowContentSaveCheck(page, apiCtx, { width: 1440, height: 900, label: 'desktop' });
  });

  test('mobile 390x844: editing only the description sends one narrow content PATCH', async ({ page }) => {
    test.setTimeout(120_000);
    await runNarrowContentSaveCheck(page, apiCtx, { width: 390, height: 844, label: 'mobile' });
  });
});
