import { expect, test } from '@playwright/test';
import { assertTravelMobileCls } from './helpers/travelMobileCls';

// Public mobile CLS and initial article data are production-smoke eligible.
// The complete cls-audit spec remains in the default local regression suite.
test('@perf @travel-mobile-cls390 five complete guest traversals stay <=0.1', assertTravelMobileCls);

type RouteCountTravel = { id?: unknown; slug?: unknown; route_track_files_count?: unknown };

// #3436: inspect the original document, before a background detail fetch can
// repair a missing SSR field. These guest probes make only real public GETs.
test.describe('@route-profile-ssr-count initial article data', () => {
  const articles = [
    { id: 544, slug: 'tropa-vedm-v-gartse-kak-proiti-hexenstieg' },
    { id: 470, slug: 'tour-du-mont-blanc-vokrug-monblana-za-10-dney' },
    { id: 967, slug: 'vismor-s-sobakoi-dom-v-vostochnoi-frizii-velosipedy-bolotnye-ozera-eviges-meer-i-lengener-meer-vecher-v-oldenburge' },
  ];

  for (const { id, slug } of articles) {
    test(`real SSR route-file count matches the API for article ${id}`, async ({ playwright, baseURL }, testInfo) => {
      const expectedSource = process.env.ROUTE_PROFILE_EXPECTED_SOURCE_SHA;
      expect(expectedSource, 'Pass the reviewed published app SHA').toMatch(/^[a-f0-9]{40}$/);
      if (!baseURL) throw new Error('SSR count acceptance requires an explicit baseURL');
      const guest = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
      try {
        const sourceResponse = await guest.get('/.build-source.json', { headers: { 'Cache-Control': 'no-cache' } });
        expect(sourceResponse.status()).toBe(200);
        const source = await sourceResponse.json();
        expect(source).toMatchObject({ sha: expectedSource, ok: true, dirty: false });

        const [documentResponse, detailResponse] = await Promise.all([
          guest.get(`/travels/${slug}`),
          guest.get(`/api/travels/${id}/`),
        ]);
        expect(documentResponse.status()).toBe(200);
        expect(detailResponse.status()).toBe(200);
        const html = await documentResponse.text();
        const loaderMatch = html.match(/globalThis\.__EXPO_ROUTER_LOADER_DATA__\s*=\s*JSON\.parse\(("(?:\\.|[^"\\])*")\)/);
        expect(loaderMatch, 'The real SSR document embeds initial loader data').not.toBeNull();
        const loader = JSON.parse(JSON.parse(loaderMatch![1])) as Record<string, { travel?: RouteCountTravel }>;
        const embedded = Object.values(loader).map(entry => entry?.travel).filter(travel => travel?.id === id);
        const detail = await detailResponse.json() as RouteCountTravel;
        await testInfo.attach('route-profile-ssr-count', {
          body: JSON.stringify({ appSHA: source.sha, article: { id, slug }, embedded, detail: {
            id: detail.id, slug: detail.slug, route_track_files_count: detail.route_track_files_count,
          } }, null, 2),
          contentType: 'application/json',
        });
        expect(embedded, 'Exactly one loader entry identifies the requested article').toHaveLength(1);
        for (const travel of [embedded[0], detail]) {
          expect(travel?.id).toBe(id);
          expect(travel?.slug).toBe(slug);
          expect(typeof travel?.route_track_files_count).toBe('number');
          expect(Number.isSafeInteger(travel?.route_track_files_count)).toBe(true);
          expect(travel?.route_track_files_count).toBeGreaterThanOrEqual(0);
        }
        expect(embedded[0]?.route_track_files_count).toBe(detail.route_track_files_count);
        const finalSourceResponse = await guest.get('/.build-source.json', { headers: { 'Cache-Control': 'no-cache' } });
        expect(finalSourceResponse.status()).toBe(200);
        expect(await finalSourceResponse.json()).toMatchObject({ sha: expectedSource, ok: true, dirty: false });
      } finally {
        await guest.dispose();
      }
    });
  }
});
