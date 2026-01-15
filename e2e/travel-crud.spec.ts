import { test, expect } from './fixtures';
import { request } from '@playwright/test';

/**
 * E2E (API-backed) CRUD for travels.
 * Requires env:
 *   - BASE_URL (or Playwright baseURL config)
 *   - E2E_API_TOKEN (DRF Token: "Token xxx")
 *
 * Uses the same payload shape as app saveFormData (see TravelFormData).
 */

const BASE_PATH = '/api/travels';
const UPsert_PATH = '/api/travels/upsert/';

const basePayload = {
  id: null,
  name: 'E2E Travel',
  description: 'Autotest travel description',
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

test.describe('Travel CRUD (API)', () => {
  test('create, edit, delete travel via API', async ({ baseURL, createdTravels }) => {
    const token = process.env.E2E_API_TOKEN;
    if (!token) {
      test.info().annotations.push({
        type: 'note',
        description: 'E2E_API_TOKEN is missing; CRUD API flow was not exercised',
      });
      return;
    }
    const targetBase = baseURL ?? process.env.BASE_URL;
    expect(targetBase).toBeTruthy();

    const apiContext = await request.newContext({
      baseURL: targetBase,
      extraHTTPHeaders: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      },
    });

    let travelId: string | number | null = null;
    try {
      // Create
      const createResp = await apiContext.put(UPsert_PATH, { data: { ...basePayload } });
      expect(createResp.ok()).toBeTruthy();
      const created = await createResp.json();
      expect(created.id).toBeTruthy();
      travelId = created.id;
      createdTravels.add(travelId);

      // Read
      const readResp = await apiContext.get(`${BASE_PATH}/${travelId}/`);
      expect(readResp.ok()).toBeTruthy();
      const readData = await readResp.json();
      expect(readData.name).toBe(basePayload.name);

      // Update
      const newName = `${basePayload.name} (edited)`;
      const updateResp = await apiContext.put(UPsert_PATH, {
        data: { ...basePayload, id: travelId, name: newName },
      });
      expect(updateResp.ok()).toBeTruthy();
      const updated = await updateResp.json();
      expect(updated.name).toBe(newName);
    } finally {
      if (travelId != null) {
        const deleteResp = await apiContext.delete(`${BASE_PATH}/${travelId}/`).catch(() => null);
        if (deleteResp) {
          expect(deleteResp.ok() || deleteResp.status() === 404).toBeTruthy();
        }
      }
      await apiContext.dispose();
    }
  });
});
