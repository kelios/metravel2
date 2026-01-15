import { request } from '@playwright/test';
import { test, expect } from './fixtures';
import { apiContextFromEnv, createOrUpdateTravel } from './helpers/e2eApi';

let createdId: string | number | null = null;

test.describe.serial('Created travels cleanup', () => {
  test('creates travel via API and registers it for cleanup', async ({ createdTravels }) => {
    const ctx = await apiContextFromEnv().catch(() => null);
    if (!ctx) {
      test.skip(true, 'E2E_API_URL + auth are required to verify cleanup');
      return;
    }

    const created = await createOrUpdateTravel(ctx, {
      id: null,
      name: `E2E Cleanup ${Date.now()}`,
      description: 'Autotest cleanup travel description long enough to pass validation in e2e flow.',
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
      year: '2026',
      budget: '',
      number_peoples: '2',
      number_days: '2',
      visa: false,
      publish: false,
      moderation: false,
    });

    createdId = created?.id ?? null;
    expect(createdId, 'Upsert did not return id').toBeTruthy();
    if (createdId != null) {
      createdTravels.add(createdId);
    }
  });

  test('removes created travel after previous test', async () => {
    if (!createdId) {
      test.skip(true, 'No travel id recorded in previous test');
      return;
    }

    const ctx = await apiContextFromEnv().catch(() => null);
    if (!ctx) {
      test.skip(true, 'E2E_API_URL + auth are required to verify cleanup');
      return;
    }

    const api = await request.newContext({
      baseURL: ctx.apiBase,
      extraHTTPHeaders: {
        Authorization: `Token ${ctx.token}`,
        'Content-Type': 'application/json',
      },
    });

    await expect
      .poll(
        async () => {
          const resp = await api.get(`/api/travels/${createdId}/`);
          return resp.status();
        },
        { timeout: 15_000 }
      )
      .toBe(404);

    await api.dispose();
  });
});
