import { expect, test } from './fixtures';
import { gotoWithRetry, mockUnavailableApi, preacceptCookies } from './helpers/navigation';

const HYDRATION_ERROR = /Minified React error #418\b|Hydration failed because the server rendered/i;

/** One rAF sample of the chrome that the static HTML already contains. */
type ShellSample = { t: number; header: boolean };

/**
 * Samples, from document-start, whether the server-rendered header is in the DOM.
 * A route module that resolves after hydration begins suspends its expo-router
 * Suspense boundary; because that boundary renders `null` in production, React
 * throws the server HTML away and the screen goes blank until the client render
 * lands (#1340). The sampler is what makes that blank frame observable.
 */
async function sampleShellPresence(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const samples: { t: number; header: boolean }[] = [];
    (window as any).__shellSamples = samples;
    const tick = () => {
      samples.push({
        t: Math.round(performance.now()),
        header: !!document.querySelector('[data-testid="main-header"]'),
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** First window where the header was present and then vanished again. */
function findBlankWindow(samples: ShellSample[]): { from: number; to: number | null } | null {
  const firstPresent = samples.findIndex((sample) => sample.header);
  if (firstPresent === -1) return null;
  const gapStart = samples.findIndex((sample, index) => index > firstPresent && !sample.header);
  if (gapStart === -1) return null;
  const back = samples.findIndex((sample, index) => index > gapStart && sample.header);
  return { from: samples[gapStart].t, to: back === -1 ? null : samples[back].t };
}

test.describe('SSR route hydration', () => {
  test('responsive lazy routes hydrate without replacing their server HTML', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await preacceptCookies(page);
    await mockUnavailableApi(page);

    const hydrationErrors: string[] = [];
    page.on('pageerror', (error) => {
      const message = String(error?.message ?? error);
      if (HYDRATION_ERROR.test(message)) hydrationErrors.push(message);
    });
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (HYDRATION_ERROR.test(text)) hydrationErrors.push(text);
    });

    for (const route of ['/login', '/registration', '/places', '/roulette']) {
      await gotoWithRetry(page, route);
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(750);
      expect(hydrationErrors, `hydration errors after ${route}`).toEqual([]);
    }
  });

  // Regression guard for #1340. The header survived hydration long before this
  // test existed — what did not survive was the frames in between: React dropped
  // the whole server-rendered route subtree for ~600 ms, so every node then
  // animated in from a zero-sized rect and inflated CLS on every route. Asserting
  // the end state is not enough; the invariant is that no frame is ever missing it.
  test('static header stays in the DOM for every frame between server HTML and app', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 412, height: 823 });
    await preacceptCookies(page);
    await mockUnavailableApi(page);
    await sampleShellPresence(page);

    for (const route of ['/places', '/', '/search']) {
      await gotoWithRetry(page, route);
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(1_500);

      const samples = await page.evaluate<ShellSample[]>(() => (window as any).__shellSamples ?? []);
      // The static export must ship the header; without it the guard would pass vacuously.
      expect(samples.some((sample) => sample.header), `no server-rendered header on ${route}`).toBe(
        true,
      );

      const blank = findBlankWindow(samples);
      expect(
        blank,
        blank
          ? `${route}: header left the DOM at ${blank.from} ms and came back at ${blank.to ?? 'never'} ms`
          : '',
      ).toBeNull();
      // No reset needed: the next gotoWithRetry loads a new document, which re-runs
      // the init script and starts a fresh sample buffer.
    }
  });
});
