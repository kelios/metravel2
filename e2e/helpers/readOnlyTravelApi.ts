import type { BrowserContext } from '@playwright/test';

type ApiWrite = { method: string; path: string };

/** Keep article reads real while simulating only this article's view metric. */
export async function installReadOnlyTravelApi(
  context: Pick<BrowserContext, 'route'>,
  { baseURL, travelId }: { baseURL: string | undefined; travelId: number },
) {
  if (!Number.isSafeInteger(travelId) || travelId <= 0) {
    throw new Error('Read-only travel API requires a positive expected travel ID.');
  }
  let webURL: URL;
  try {
    if (!baseURL) throw new Error();
    webURL = new URL(baseURL);
  } catch {
    throw new Error('Read-only travel API requires an explicit trusted HTTP(S) base URL.');
  }
  if (!['http:', 'https:'].includes(webURL.protocol) || webURL.username || webURL.password || webURL.search || webURL.hash) {
    throw new Error('Read-only travel API requires an explicit trusted HTTP(S) base URL.');
  }
  const expectedViewURL = `${webURL.origin}/api/travels/${travelId}/view/`;
  const handledViews: ApiWrite[] = [];
  const unexpectedWrites: ApiWrite[] = [];

  await context.route('**/api/**', async route => {
    const request = route.request();
    const method = request.method();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      await route.continue();
      return;
    }
    const write = { method, path: new URL(request.url()).pathname };
    // Raw URL equality also rejects query/hash, credentials and path aliases.
    if (method === 'POST' && request.url() === expectedViewURL) {
      await route.fulfill({ status: 204 });
      handledViews.push(write);
      return;
    }
    unexpectedWrites.push(write);
    await route.abort('blockedbyclient');
  });
  return { handledViews, unexpectedWrites };
}
