import { test, expect, request } from '@playwright/test';

/**
 * E2E API test: upload travel image and ensure URL is returned.
 * Requires env:
 *   - BASE_URL (or Playwright baseURL config)
 *   - E2E_API_TOKEN (DRF Token: "Token xxx")
 */

const UPLOAD_PATH = '/api/upload';
const UPSERT_TRAVEL = '/api/travels/upsert/';
const TRAVEL_BASE = '/api/travels';

const basePayload = {
  id: null,
  name: 'E2E Travel for Upload',
  description: 'Autotest travel for image upload',
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
  year: '2024',
  budget: '',
  number_peoples: '2',
  number_days: '3',
  visa: false,
  publish: false,
  moderation: false,
};

// 1x1 PNG pixel
const tinyPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
  'base64'
);

test.describe('Image upload API', () => {
  test('uploads travel address image and returns URL', async ({ baseURL }) => {
    const token = process.env.E2E_API_TOKEN;
    test.skip(!token, 'E2E_API_TOKEN is required');

    const targetBase = baseURL ?? process.env.BASE_URL;
    expect(targetBase).toBeTruthy();

    const apiContext = await request.newContext({
      baseURL: targetBase,
      extraHTTPHeaders: {
        Authorization: `Token ${token}`,
      },
    });

    // Create travel to get id
    const createResp = await apiContext.put(UPSERT_TRAVEL, { data: { ...basePayload } });
    expect(createResp.ok()).toBeTruthy();
    const created = await createResp.json();
    const travelId = created.id;
    expect(travelId).toBeTruthy();

    // Upload image for travel address collection
    const uploadResp = await apiContext.post(UPLOAD_PATH, {
      multipart: {
        file: {
          name: 'tiny.png',
          mimeType: 'image/png',
          buffer: tinyPngBuffer,
        },
        collection: 'travelImageAddress',
        id: String(travelId),
      },
    });

    expect(uploadResp.ok()).toBeTruthy();
    const rawBody = await uploadResp.text();
    expect(rawBody?.length).toBeGreaterThan(0);

    let url: string | undefined;
    try {
      const parsed = JSON.parse(rawBody);
      url = parsed?.url || parsed?.data?.url || parsed?.path || parsed?.file_url;
    } catch {
      url = rawBody.trim();
    }

    expect(url).toBeTruthy();
    // Basic sanity that URL looks like http(s)
    expect(url?.startsWith('http')).toBeTruthy();

    // Optionally verify travel still readable
    const readResp = await apiContext.get(`${TRAVEL_BASE}/${travelId}/`);
    expect(readResp.ok()).toBeTruthy();

    // Cleanup best-effort
    await apiContext.delete(`${TRAVEL_BASE}/${travelId}/`).catch(() => undefined);
  });
});
