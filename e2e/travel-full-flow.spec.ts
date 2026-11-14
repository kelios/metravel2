import { test, expect, request, type APIRequestContext, type BrowserContext } from '@playwright/test';

const {
  openOwnedBatch,
  targetConfig,
  ownsTravel,
  csrf,
  json: readFixtureJson,
} = require('./prod-probe/travelEditorFixtures');
const { openRoleContext, enterList, actualEdit, selectStep } = require('./helpers/editorFixtureBrowser');
const { formatProbeError } = require('./prod-probe/prodProbe');

type PublishedFixture = {
  id: number;
  label: string;
  name: string;
  slug: string;
  before: { publication_status: string; moderation_decision: string };
};

test.describe('Travel full flow (API seed + UI verify)', () => {
  test('create -> open details -> favorite -> edit -> cleanup', async ({ browser, baseURL }, testInfo) => {
    const backendUrl = String(process.env.E2E_API_URL || '').trim().replace(/\/+$/, '');
    expect(baseURL, 'Explicit local browser origin is required').toBeTruthy();
    expect(backendUrl, 'Explicit local backend origin is required').toBeTruthy();
    if (!baseURL || !backendUrl) throw new Error('Local full-flow targets are unavailable');
    expect(targetConfig(baseURL, backendUrl).production, 'Full-flow fixtures are local only').toBe(false);
    expect(process.env.E2E_SUITE).toBe('live-contract');
    expect(process.env.E2E_ALLOW_LIVE_MUTATIONS).toBe('1');
    const appApi = String(process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
    expect(!appApi || appApi === backendUrl, 'UI and fixtures must use the same local backend').toBe(true);

    let batch: Awaited<ReturnType<typeof openOwnedBatch>> | undefined;
    let fixture: PublishedFixture | undefined;
    let authorApi: APIRequestContext | undefined;
    let guestApi: APIRequestContext | undefined;
    let context: BrowserContext | undefined;
    let editedName: string | undefined;
    let scenarioFailed = false;
    let scenarioFailure: unknown;
    const cleanupFailures: unknown[] = [];

    try {
      batch = await openOwnedBatch({ baseUrl: baseURL, backendUrl,
        runId: `run-full-flow-${Date.now()}-${process.pid}-${testInfo.retry}`, needOther: false });
      await batch.setup();
      expect(batch.reg.accounts.author.ordinaryVerified, 'Exact owned author must be neither staff nor superuser').toBe(true);

      const published = batch.reg.fixtures.find((item: PublishedFixture) => item.label === 'public') as PublishedFixture | undefined;
      expect(published, 'Real moderator-approved public fixture is required').toBeTruthy();
      if (!published) throw new Error('Published owned fixture is unavailable');
      fixture = published;
      expect(published.before.publication_status).toBe('published');
      expect(published.before.moderation_decision).toBe('approved');
      expect(published.slug).toBeTruthy();
      editedName = `${published.name} edited`;
      const nextName = editedName;
      authorApi = await batch.authorApi();
      guestApi = await request.newContext({ baseURL: batch.reg.origin, storageState: { cookies: [], origins: [] } });

      const publicPath = `/api/travels/by-slug/${encodeURIComponent(published.slug)}/`;
      const publicDto = await readFixtureJson(await guestApi.get(publicPath), 'Published fixture must be publicly readable');
      expect(Number(publicDto.id)).toBe(published.id);
      expect(publicDto.name).toBe(published.name);

      const opened = await openRoleContext(browser, batch, 'author', 1440);
      context = opened.context;
      const page = opened.page;
      const apiOrigins = new Set([batch.reg.origin, new URL(backendUrl).origin]);
      const detailPaths = [
        `/api/travels/${published.id}/`,
        publicPath,
        `/api/travels/resolve-slug/${encodeURIComponent(published.slug)}/`,
      ];
      const detailResponsePromise = page.waitForResponse(response => {
        const url = new URL(response.url());
        return response.request().method() === 'GET' && apiOrigins.has(url.origin) && detailPaths.includes(url.pathname);
      }, { timeout: 60_000 });
      await page.goto(`/travels/${encodeURIComponent(published.slug)}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      const detailBody = await readFixtureJson(await detailResponsePromise, 'Public details browser read');
      const detailDto = detailBody.item ?? detailBody;
      expect(Number(detailDto.id)).toBe(published.id);
      await expect(page.getByTestId('travel-details-page')).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(published.name, { exact: true }).first()).toBeVisible({ timeout: 30_000 });

      const favorite = await authorApi.patch(`/api/travels/${published.id}/mark-as-favorite/`, {
        headers: await csrf(authorApi, batch.reg.origin),
      });
      expect(favorite.ok(), 'Ordinary author favorite API command must succeed').toBe(true);
      await page.goto('/favorites', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Хочу поехать', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(published.name, { exact: true }).first()).toBeVisible({ timeout: 30_000 });

      await enterList(page, batch.reg.origin, 'zero');
      await actualEdit(page, published, batch.reg);
      await selectStep(page, published, 1);
      const nameInput = page.locator('#field-name').getByRole('textbox');
      await expect(nameInput).toHaveValue(published.name, { timeout: 30_000 });
      const contentPath = `/api/travels/${published.id}/content/`;
      const saveResponsePromise = page.waitForResponse(response => {
        const url = new URL(response.url());
        if (response.request().method() !== 'PATCH' || !apiOrigins.has(url.origin) || url.pathname !== contentPath) return false;
        try { return response.request().postDataJSON()?.name === nextName; }
        catch { return false; }
      });
      await nameInput.fill(nextName);
      await nameInput.blur();
      const saved = await readFixtureJson(await saveResponsePromise, 'Title autosave must commit through content PATCH');
      expect(Number(saved.id)).toBe(published.id);
      expect(saved.name).toBe(nextName);

      const updated = await readFixtureJson(await authorApi.get(`/api/travels/${published.id}/`), 'Read back saved owned title');
      expect(ownsTravel(updated, { ...published, name: nextName }, batch.reg)).toBe(true);
      expect(updated.publication_status, 'Title-only autosave preserves publication').toBe('published');
      expect(typeof updated.slug).toBe('string');
      expect(updated.slug).toBeTruthy();
      expect(saved.slug).toBe(updated.slug);
      const updatedPublicPath = `/api/travels/by-slug/${encodeURIComponent(updated.slug)}/`;
      const updatedPublic = await readFixtureJson(await guestApi.get(updatedPublicPath), 'Renamed fixture remains public');
      expect(Number(updatedPublic.id)).toBe(published.id);
      expect(updatedPublic.name).toBe(nextName);

      await page.goto(`/travels/${encodeURIComponent(updated.slug)}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('travel-details-page')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(nextName, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    } catch (error) {
      scenarioFailed = true;
      scenarioFailure = error;
    } finally {
      // Close the editor before cleanup so an outstanding autosave cannot recreate it.
      try { await context?.close(); } catch (error) { cleanupFailures.push(error); }
      try { await guestApi?.dispose(); } catch (error) { cleanupFailures.push(error); }
      try {
        if (authorApi && fixture && batch) {
          const currentResponse = await authorApi.get(`/api/travels/${fixture.id}/`);
          if (currentResponse.status() !== 404) {
            const current = await readFixtureJson(currentResponse, 'Verify exact renamed fixture before cleanup');
            const allowedNames = [fixture.name, editedName].filter((name): name is string => typeof name === 'string');
            expect(allowedNames.some(name => ownsTravel(current, { ...fixture, name }, batch.reg)),
              'Cleanup requires exact created ID, ordinary owner and controlled original/edited name').toBe(true);
            const deleted = await authorApi.delete(`/api/travels/${fixture.id}/`, {
              headers: await csrf(authorApi, batch.reg.origin),
            });
            expect(deleted.status(), 'Owned renamed travel deletion must be acknowledged').toBe(204);
          }
          expect((await authorApi.get(`/api/travels/${fixture.id}/`)).status()).toBe(404);
        }
      } catch (error) { cleanupFailures.push(error); }
      try { await authorApi?.dispose(); } catch (error) { cleanupFailures.push(error); }
      if (batch) {
        try { await batch.cleanup(); expect(batch.reg.cleaned).toBe(true); }
        catch (error) { cleanupFailures.push(error); }
        finally {
          try { await batch.close(); } catch (error) { cleanupFailures.push(error); }
        }
      }
      await testInfo.attach('owned-published-full-flow-cleanup', {
        contentType: 'application/json',
        body: JSON.stringify({ travelId: fixture?.id ?? null, authorId: batch?.reg.accounts.author?.id ?? null,
          scenarioFailed, cleanupComplete: batch?.reg.cleaned === true, cleanupCounts: batch?.reg.cleanupCounts ?? null,
          errors: cleanupFailures.map(formatProbeError) }),
      });
    }
    if (scenarioFailed) throw scenarioFailure;
    if (cleanupFailures.length) throw cleanupFailures[0];
  });
});
