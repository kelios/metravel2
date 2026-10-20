import { request, type Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { apiContextFromTracker, apiRequestContext, deleteTravel, readTravel } from './helpers/e2eApi';
import { WEB_AUTH_COOKIE_NAME, webAuthTokenFromCookies } from './helpers/auth';
import { hideRecommendationsBanner, seedNecessaryConsent } from './helpers/storage';

const basePayload = {
  id: null,
  countries: [], cities: [], over_nights_stay: [], complexity: [], companions: [],
  recommendation: null, plus: null, minus: null, youtube_link: null, gallery: [],
  categories: [], countryIds: [], travelAddressIds: [], travelAddressCity: [],
  travelAddressCountry: [], travelAddressAdress: [], travelAddressCategory: [],
  coordsMeTravel: [], thumbs200ForCollectionArr: [], travelImageThumbUrlArr: [],
  travelImageThumbUrArr: [], travelImageAddress: [], categoriesIds: [], transports: [],
  month: [], year: '2026', budget: '', number_peoples: '1', number_days: '1',
  visa: false, publish: false, moderation: false,
};

type PrivateRead = {
  requestId: string;
  documentPath: string;
  initiator: string;
  frames: Array<{ functionName: string; path: string; lineNumber: number }>;
  authCookieAllowed?: boolean;
  status?: number;
};

function sanitize(message: string): string {
  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/((?:authToken|userToken|password|token)[=:\s]+)[^\s,;}]+/gi, '$1[redacted]');
}

// Attach while the popup is still about:blank. The bridge document route waits
// for this observer, so neither an early preload nor a hydration error is lost.
async function observePreview(page: Page, detailPath: string) {
  const errors: string[] = [];
  const consoleMessages: Array<{ type: string; text: string }> = [];
  const reads = new Map<string, PrivateRead>();
  const authCookies = new Map<string, boolean>();
  const statuses = new Map<string, number>();
  page.on('pageerror', (error) => errors.push(sanitize(error.message)));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleMessages.push({ type: message.type(), text: sanitize(message.text()) });
    }
  });
  const cdp = await page.context().newCDPSession(page);
  cdp.on('Network.requestWillBeSent', (event) => {
    if (event.request.method !== 'GET' || new URL(event.request.url).pathname !== detailPath) return;
    const frames: PrivateRead['frames'] = [];
    let stack = event.initiator.stack;
    while (stack && frames.length < 20) {
      for (const frame of stack.callFrames) {
        frames.push({
          functionName: frame.functionName,
          path: frame.url.startsWith('http') ? new URL(frame.url).pathname : frame.url,
          lineNumber: frame.lineNumber,
        });
      }
      stack = stack.parent;
    }
    reads.set(event.requestId, {
      requestId: event.requestId,
      documentPath: new URL(event.documentURL).pathname,
      initiator: event.initiator.type,
      frames,
    });
  });
  cdp.on('Network.requestWillBeSentExtraInfo', (event) => {
    // Keep only a boolean; never retain header values or cookie contents.
    const sentAuthCookie = Object.entries(event.headers).some(([name, value]) =>
      name.toLowerCase() === 'cookie' && /(?:^|;\s*)authToken=/.test(String(value)));
    authCookies.set(event.requestId, sentAuthCookie && event.associatedCookies.some((entry) =>
      entry.cookie.name === WEB_AUTH_COOKIE_NAME && entry.blockedReasons.length === 0));
  });
  cdp.on('Network.responseReceived', (event) => statuses.set(event.requestId, event.response.status));
  await cdp.send('Network.enable');
  return {
    errors, consoleMessages,
    reads: () => Array.from(reads.values(), (row) => ({
      ...row, authCookieAllowed: authCookies.get(row.requestId), status: statuses.get(row.requestId),
    })),
    close: () => cdp.detach(),
  };
}

test.describe('Draft travel owner preview (real cookie session)', () => {
  test.describe.configure({ mode: 'default' });

  for (const width of [390, 1440]) {
    test.describe(`${width}px viewport`, () => {
      test.use({ viewport: { width, height: 900 } });
      test(`editor opens a cold private preview without hydration errors at ${width}px`, async (
        { page, context, createdTravels }, testInfo,
      ) => {
        test.setTimeout(180_000);
        const baseURL = String(testInfo.project.use.baseURL || '');
        const apiBase = String(process.env.E2E_API_URL || '').trim();
        expect(apiBase, 'The live-contract suite requires an explicit E2E_API_URL').toBeTruthy();

        // global-setup issues the real web session. Do not fabricate storage auth,
        // seed cookies, re-login (which rotates this session), or mock its probe.
        const cookies = await context.cookies();
        const token = webAuthTokenFromCookies(cookies, baseURL);
        expect(Boolean(token), 'Run live-contract global-setup with an authorized test account').toBe(true);
        expect(cookies.some((cookie) => cookie.name === WEB_AUTH_COOKIE_NAME && cookie.httpOnly)).toBe(true);
        const apiContext = apiContextFromTracker({ apiBase, token });
        if (!apiContext) throw new Error('Real web-cookie session is required');
        const ownerApi = await apiRequestContext(apiContext);
        const guestApi = await request.newContext({ baseURL: apiBase, storageState: { cookies: [], origins: [] } });

        await context.addInitScript(seedNecessaryConsent);
        await context.addInitScript(hideRecommendationsBanner);
        await context.addInitScript(() => {
          window.localStorage.setItem('@metravel/locale-preference:v1', JSON.stringify({
            version: 1, mode: 'explicit', locale: 'ru',
          }));
          Object.defineProperty(window, '__draftPreviewDocumentStart', {
            value: { pathname: location.pathname, search: location.search, readyState: document.readyState },
          });
        });
        // Context routes also cover the popup's FIRST request; page.route does not.
        // Counters are intercepted before any collection; application APIs stay live.
        await context.route((url) =>
          /(^|\.)(google-analytics\.com|analytics\.google\.com|googletagmanager\.com|mc\.yandex\.(ru|com))$/i.test(url.hostname),
        (route) => route.fulfill({ status: 204, body: '' }));

        let travelId: number | undefined;
        let popup: Page | undefined;
        let observation: Awaited<ReturnType<typeof observePreview>> | undefined;
        let observing: Promise<Awaited<ReturnType<typeof observePreview>>> | undefined;
        const observePopup = (candidate: Page) => {
          if (candidate === page) return;
          observing ??= observePreview(candidate, `/api/travels/${travelId}/`);
          // The same promise is awaited by the document route and by the test.
          void observing.catch(() => undefined);
        };

        try {
          const meResponse = await ownerApi.get('/api/user/me/');
          expect(meResponse.status(), 'The saved cookie must belong to a live API session').toBe(200);
          const me = await meResponse.json();
          expect(Number(me.id)).toBeGreaterThan(0);

          // Control: a normal /travel/new still renders the empty create wizard.
          await page.goto('/travel/new', { waitUntil: 'domcontentloaded' });
          await expect(page.locator('#field-name input')).toHaveValue('', { timeout: 60_000 });
          await expect(page).toHaveURL((url) => url.pathname === '/travel/new' && !url.search);

          const suffix = `${Date.now()}-${width}-${testInfo.retry}`;
          const title = `E2E owner preview ${suffix}`;
          const descriptionMarker = `Private draft description ${suffix}`;
          const createResponse = await ownerApi.put('/api/travels/upsert/', {
            data: {
              ...basePayload, name: title, description: `<p>${descriptionMarker}</p>`,
              slug: `e2e-owner-preview-${suffix}`,
            },
          });
          expect(createResponse.ok(), 'Creating the owned draft must reach the real API').toBe(true);
          const created = await createResponse.json();
          travelId = Number(created.id);
          expect(travelId).toBeGreaterThan(0);
          createdTravels.add(travelId);
          const saved = await readTravel(apiContext, travelId);
          expect(String(saved.userIds ?? saved.user?.id)).toBe(String(me.id));
          expect(saved.publish).toBe(false);
          expect(saved.moderation).toBe(false);
          expect(saved.description).toContain(descriptionMarker);
          expect((await guestApi.get(`/api/travels/${travelId}/`)).status(), 'Guests cannot read the draft').toBe(404);

          await page.goto(`/travel/${travelId}`, { waitUntil: 'domcontentloaded' });
          await expect(page.locator('#field-name input')).toHaveValue(title, { timeout: 60_000 });
          await page.getByTestId('travel-wizard-more').click();
          const openTravel = page.getByText('Открыть путешествие', { exact: true });
          await expect(openTravel).toBeVisible();

          context.on('page', observePopup);
          const bridgePath = `/travel/new?previewTravel=${travelId}`;
          await context.route((url) => url.pathname === '/travel/new' && url.search === `?previewTravel=${travelId}`, async (route) => {
            // A popup navigation may start before request.frame() is available.
            const candidate = context.pages().find((openPage) => openPage !== page);
            if (candidate) observePopup(candidate);
            if (!observing) throw new Error('The preview window must open before its bridge document');
            await observing;
            await route.fallback();
          });
          const bridgeResponse = context.waitForEvent('response', {
            predicate: (response) => response.request().isNavigationRequest()
              && new URL(response.url()).pathname + new URL(response.url()).search === bridgePath,
          });
          const popupOpened = page.waitForEvent('popup');
          await openTravel.click();
          popup = await popupOpened;
          observation = await observing;
          if (!observation) throw new Error('The cold popup was not observed before document execution');
          expect((await bridgeResponse).status(), 'The cold document must be the exported new shell').toBe(200);
          await expect(popup).toHaveURL((url) => url.pathname === `/travels/${travelId}` && !url.search, { timeout: 60_000 });
          await expect(popup.getByTestId('travel-details-title')).toHaveText(title, { timeout: 60_000 });
          const description = popup.getByTestId('travel-description');
          await description.scrollIntoViewIfNeeded();
          await expect(description).toContainText(descriptionMarker);
          await expect(description.getByText(descriptionMarker, { exact: true })).toBeVisible();

          const documentStart = await popup.evaluate(() =>
            (window as unknown as { __draftPreviewDocumentStart: { pathname: string; search: string } }).__draftPreviewDocumentStart);
          expect(documentStart.pathname + documentStart.search).toBe(bridgePath);
          await expect.poll(() => observation!.reads().filter((row) => row.status === 200 && row.authCookieAllowed).length,
            { message: 'A real cookie-authenticated private detail GET must finish' }).toBeGreaterThan(0);
          const reads = observation.reads();
          expect(reads.every((row) => row.authCookieAllowed === true && row.status === 200),
            'No anonymous or failing private preload may precede the owner detail read').toBe(true);
          expect(reads.some((row) => row.frames.length > 0), 'Browser initiators must identify the detail reader').toBe(true);
          expect(reads.flatMap((row) => row.frames).some((frame) => frame.path.includes('travel-hero-preload')),
            'The public anonymous preloader must not fetch a private author preview').toBe(false);
          expect((await guestApi.get(`/api/travels/${travelId}/`)).status(), 'Preview must preserve guest privacy').toBe(404);
          await testInfo.attach(`owner-preview-${width}`, { body: await popup.screenshot(), contentType: 'image/png' });
          expect(observation.errors, 'Every uncaught popup pageerror is a failure').toEqual([]);
          expect(observation.consoleMessages.filter((message) =>
            /(?:React.*#(?:418|419)|hydration|hydrating|did not match)/i.test(message.text)),
          'Hydration errors must never be suppressed').toEqual([]);
        } finally {
          context.off('page', observePopup);
          observation ??= await observing?.catch(() => undefined);
          try {
            if (observation) {
              await testInfo.attach(`owner-preview-network-console-${width}`, {
                body: Buffer.from(JSON.stringify({
                  reads: observation.reads(), pageErrors: observation.errors, console: observation.consoleMessages,
                }, null, 2)),
                contentType: 'application/json',
              });
            }
          } finally {
            await observation?.close().catch(() => undefined);
            await popup?.close().catch(() => undefined);
            await page.close().catch(() => undefined); // Stop autosave before deleting only our fixture.
            try {
              if (travelId) {
                await deleteTravel(apiContext, travelId);
                expect((await ownerApi.get(`/api/travels/${travelId}/`)).status(), 'Owned fixture cleanup must be verified').toBe(404);
                createdTravels.delete(travelId);
              }
            } finally {
              await ownerApi.dispose();
              await guestApi.dispose();
            }
          }
        }
      });
    });
  }
});
