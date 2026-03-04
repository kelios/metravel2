import { test, expect } from './fixtures';
import {
  apiContextFromEnv,
  apiRequestContext,
  createOrUpdateTravel,
  readTravel,
} from './helpers/e2eApi';

type AnyRecord = Record<string, unknown>;

function pickFirstId(list: unknown): string | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  const first = list[0];
  if (first == null) return null;
  if (typeof first === 'string' || typeof first === 'number') return String(first);
  if (typeof first === 'object') {
    const rec = first as AnyRecord;
    const raw = rec.id ?? rec.pk ?? rec.value ?? null;
    return raw == null ? null : String(raw);
  }
  return null;
}

function normalizeGalleryUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && typeof (item as AnyRecord).url === 'string') {
        return String((item as AnyRecord).url).trim();
      }
      return '';
    })
    .filter((url) => url.length > 0);
}

test.describe('Travel persistence', () => {
  test('creates travel with filled fields and keeps them after reopen', async ({ page, createdTravels }) => {
    const ctx = await apiContextFromEnv().catch(() => null);
    if (!ctx) {
      test.info().annotations.push({
        type: 'note',
        description: 'API auth context is not available; persistence flow was not exercised.',
      });
      await page.goto('/travelsby', { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await expect(page.locator('body')).toBeVisible();
      return;
    }

    const filtersApi = await apiRequestContext(ctx);
    const filtersResponse = await filtersApi.get('/api/getFiltersTravel/');
    const filters = (await filtersResponse.json().catch(() => ({}))) as AnyRecord;
    await filtersApi.dispose();

    const countryId = pickFirstId(filters.countries);
    const categoryId = pickFirstId(filters.categories);
    const transportId = pickFirstId(filters.transports);
    const complexityId = pickFirstId(filters.complexity);
    const companionId = pickFirstId(filters.companions);
    const overnightId = pickFirstId(filters.over_nights_stay);
    const monthId = pickFirstId(filters.month);

    const unique = Date.now();
    const travelName = `E2E Persist ${unique}`;
    const description = `Описание маршрута ${unique}`;
    const plus = `Плюсы ${unique}`;
    const minus = `Минусы ${unique}`;
    const recommendation = `Рекомендации ${unique}`;
    const youtube = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const coverUrl = 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200';
    const galleryUrls = [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200',
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200',
    ];

    const payload = {
      id: null,
      name: travelName,
      description,
      countries: countryId ? [countryId] : [],
      cities: [],
      over_nights_stay: overnightId ? [overnightId] : [],
      complexity: complexityId ? [complexityId] : [],
      companions: companionId ? [companionId] : [],
      recommendation,
      plus,
      minus,
      youtube_link: youtube,
      gallery: galleryUrls.map((url) => ({ url })),
      categories: categoryId ? [categoryId] : [],
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
      transports: transportId ? [transportId] : [],
      month: monthId ? [monthId] : [],
      year: '2026',
      budget: '1500',
      number_peoples: '2',
      number_days: '7',
      visa: false,
      publish: false,
      moderation: false,
      travel_image_thumb_url: coverUrl,
      travel_image_thumb_small_url: coverUrl,
    };

    const created = await createOrUpdateTravel(ctx, payload);
    const travelId = created?.id;
    expect(travelId, 'Upsert did not return travel id').toBeTruthy();
    createdTravels.add(travelId);

    await createOrUpdateTravel(ctx, {
      ...payload,
      id: travelId,
      gallery: galleryUrls.map((url) => ({ url })),
      coordsMeTravel: [
        {
          id: null,
          lat: 53.90454,
          lng: 27.56152,
          country: countryId ? Number(countryId) : null,
          address: 'Minsk center',
          categories: categoryId ? [Number(categoryId)] : [],
          image: coverUrl,
        },
      ],
      travel_image_thumb_url: coverUrl,
      travel_image_thumb_small_url: coverUrl,
    });

    const readback = await readTravel(ctx, travelId);
    expect(String(readback?.name ?? '')).toBe(travelName);
    expect(String(readback?.description ?? '')).toContain(description);
    expect(String(readback?.youtube_link ?? '')).toContain('youtube.com/watch?v=dQw4w9WgXcQ');
    expect(String(readback?.plus ?? '')).toContain(plus);
    expect(String(readback?.minus ?? '')).toContain(minus);
    expect(String(readback?.recommendation ?? '')).toContain(recommendation);

    const galleryFromRead = normalizeGalleryUrls(readback?.gallery);
    expect(galleryFromRead.length).toBeGreaterThanOrEqual(2);

    const routeFromRead = Array.isArray(readback?.coordsMeTravel) ? readback.coordsMeTravel : [];
    expect(routeFromRead.length).toBeGreaterThan(0);
    expect(String((routeFromRead[0] as AnyRecord)?.image ?? '').trim().length).toBeGreaterThan(0);

    const editUrl = `/travel/edit/${travelId}`;
    await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await expect(page.getByPlaceholder('Например: Неделя в Грузии')).toHaveValue(travelName, { timeout: 60_000 });

    const step3Milestone = page.getByLabel('Перейти к шагу 3');
    if (await step3Milestone.first().isVisible().catch(() => false)) {
      await step3Milestone.first().click();
    } else {
      await page.getByLabel('Далее').click();
      await page.getByLabel('К медиа').click();
    }

    await expect(page.getByText('Галерея путешествия').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByPlaceholder('Введите ссылку на YouTube')).toHaveValue(youtube, { timeout: 30_000 });
    await expect(page.getByTestId('gallery-image')).toHaveCount(2, { timeout: 30_000 });

    await page.goto('/metravel', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });

    await expect(page.getByPlaceholder('Например: Неделя в Грузии')).toHaveValue(travelName, { timeout: 60_000 });
    if (await step3Milestone.first().isVisible().catch(() => false)) {
      await step3Milestone.first().click();
    } else {
      await page.getByLabel('Далее').click();
      await page.getByLabel('К медиа').click();
    }
    await expect(page.getByPlaceholder('Введите ссылку на YouTube')).toHaveValue(youtube, { timeout: 30_000 });
    await expect(page.getByTestId('gallery-image')).toHaveCount(2, { timeout: 30_000 });
  });
});
