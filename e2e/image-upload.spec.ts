import { test, expect } from './fixtures';
import { request } from '@playwright/test';
import { liveUploadImage } from './helpers/liveUploadImage';

/**
 * E2E API test: upload a created route point's image and verify its association.
 * Requires env:
 *   - BASE_URL (or Playwright baseURL config)
 *   - E2E_API_TOKEN (raw DRF token supplied privately by the launcher)
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
  travelImageThumbUrArr: [],
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

type CountryReference = { id?: number; country_id?: number };
type PointReadback = { id: number; address: string; image?: string | null };
type TravelReadback = { id: number; name: string; coordsMeTravel: PointReadback[] };

test.describe('Image upload API', () => {
  test('uploads travel address image and returns URL', async ({ baseURL, createdTravels }) => {
    const token = process.env.E2E_API_TOKEN;
    expect(token, 'E2E_API_TOKEN is required for the live-contract image upload flow').toBeTruthy();
    if (!token) throw new Error('E2E_API_TOKEN is required');

    const targetBase = baseURL ?? process.env.BASE_URL;
    expect(targetBase).toBeTruthy();
    if (!targetBase) throw new Error('Image upload requires the configured live base URL');

    const apiContext = await request.newContext({
      baseURL: targetBase,
      extraHTTPHeaders: {
        Authorization: `Token ${token}`,
      },
    });

    let travelId: number | null = null;
    try {
      const countriesResponse = await apiContext.get('/api/countries/');
      expect(countriesResponse.ok(), 'Live country references must be available').toBe(true);
      const countriesBody = await countriesResponse.json() as CountryReference[] | {
        results?: CountryReference[]; data?: CountryReference[];
      };
      const countries = Array.isArray(countriesBody) ? countriesBody : countriesBody.results ?? countriesBody.data ?? [];
      const countryId = Number(countries[0]?.id ?? countries[0]?.country_id);
      expect(Number.isInteger(countryId) && countryId > 0, 'A real country reference is required').toBe(true);

      const name = `${basePayload.name} ${Date.now()}`;
      const pointAddress = 'E2E image upload route point';
      const createResp = await apiContext.put(UPSERT_TRAVEL, { data: {
        ...basePayload,
        name,
        countries: [countryId],
        coordsMeTravel: [{
          id: null, lat: 53.90111, lng: 27.56111, country: countryId,
          address: pointAddress, categories: [], image: null,
        }],
      } });
      expect(createResp.ok()).toBe(true);
      const created = await createResp.json() as { id: number };
      expect(Number.isInteger(created.id) && created.id > 0, 'Upsert must return a positive travel ID').toBe(true);
      travelId = created.id;
      createdTravels.add(travelId);

      const readCreatedTravel = async (): Promise<TravelReadback> => {
        const response = await apiContext.get(`${TRAVEL_BASE}/${travelId}/`);
        expect(response.ok()).toBe(true);
        const travel = await response.json() as TravelReadback;
        expect(travel.id).toBe(travelId);
        expect(travel.name).toBe(name);
        return travel;
      };
      const seeded = await readCreatedTravel();
      expect(seeded.coordsMeTravel).toHaveLength(1);
      const addressId = Number(seeded.coordsMeTravel[0].id);
      expect(Number.isInteger(addressId) && addressId > 0, 'Readback must return the created point ID').toBe(true);
      expect(seeded.coordsMeTravel[0].address).toBe(pointAddress);

      const uploadResp = await apiContext.post(UPLOAD_PATH, {
        multipart: {
          file: liveUploadImage(),
          collection: 'travelImageAddress',
          id: String(addressId),
        },
      });
      expect(uploadResp.ok(), `Point image upload returned HTTP ${uploadResp.status()}`).toBe(true);
      const rawBody = await uploadResp.text();
      let url: string | undefined;
      try {
        const parsed = JSON.parse(rawBody) as string | {
          url?: string; data?: { url?: string }; path?: string; file_url?: string;
        };
        url = typeof parsed === 'string' ? parsed : parsed?.url || parsed?.data?.url || parsed?.path || parsed?.file_url;
      } catch {
        url = rawBody.trim();
      }
      expect(url, 'Upload must return an HTTP image URL').toMatch(/^https?:\/\//);

      const readback = await readCreatedTravel();
      expect(readback.coordsMeTravel).toHaveLength(1);
      const persistedPoint = readback.coordsMeTravel.find((point) => Number(point.id) === addressId);
      expect(persistedPoint?.address).toBe(pointAddress);
      const persistedImage = String(persistedPoint?.image ?? '');
      expect(persistedImage).not.toBe('');
      expect(new URL(persistedImage, targetBase).pathname).toBe(new URL(String(url)).pathname);

      const imageResponse = await apiContext.get(String(url), { headers: { Authorization: '' } });
      expect(imageResponse.ok()).toBe(true);
      expect(imageResponse.headers()['content-type']).toMatch(/^image\//);
      expect((await imageResponse.body()).length).toBeGreaterThan(0);
    } finally {
      try {
        if (travelId !== null) {
          const cleanup = await apiContext.delete(`${TRAVEL_BASE}/${travelId}/`).catch(() => null);
          const removed = cleanup !== null && (cleanup.ok() || cleanup.status() === 404);
          expect.soft(removed, `Created travel/point cleanup returned ${cleanup?.status() ?? 'a network error'}`).toBe(true);
          if (removed) createdTravels.delete(travelId);
        }
      } finally {
        await apiContext.dispose();
      }
    }
  });
});
