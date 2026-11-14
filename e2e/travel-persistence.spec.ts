import { test, expect } from './fixtures';
import { request } from '@playwright/test';
import {
  apiContextFromEnv,
  apiRequestContext,
  createOrUpdateTravel,
  E2EApiContext,
  readTravel,
  reorderGalleryApi,
} from './helpers/e2eApi';
import { liveUploadImage } from './helpers/liveUploadImage';

const { selectStep } = require('./helpers/editorFixtureBrowser');

type AnyRecord = Record<string, unknown>;

type UploadedImage = {
  id: number;
  url: string;
};

const UPLOAD_PATH = '/api/upload';

function pickFirstId(list: unknown): string | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  const first = list[0];
  if (first == null) return null;
  if (typeof first === 'string' || typeof first === 'number') return String(first);
  if (typeof first === 'object') {
    const rec = first as AnyRecord;
    const raw = rec.id ?? rec.country_id ?? rec.pk ?? rec.value ?? null;
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

function normalizeGalleryIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (item && typeof item === 'object') {
        const rawId = (item as AnyRecord).id ?? (item as AnyRecord).pk ?? null;
        const parsed = Number(rawId);
        if (Number.isFinite(parsed)) return parsed;
      }

      const url = typeof item === 'string'
        ? item
        : item && typeof item === 'object' && typeof (item as AnyRecord).url === 'string'
          ? String((item as AnyRecord).url)
          : '';
      const match = url.match(/(?:^|\/)gallery\/(\d+)(?:\/|$)/i);
      const parsed = match?.[1] ? Number(match[1]) : NaN;
      return Number.isFinite(parsed) ? parsed : null;
    })
    .filter((id): id is number => Number.isFinite(id));
}

function parseUploadResponse(rawBody: string): { id: number | null; url: string | null } {
  if (!rawBody.trim()) return { id: null, url: null };

  try {
    const parsed = JSON.parse(rawBody) as AnyRecord;
    const rawId = parsed.id ?? (parsed.data as AnyRecord | undefined)?.id;
    const rawUrl =
      parsed.url ??
      (parsed.data as AnyRecord | undefined)?.url ??
      parsed.path ??
      parsed.file_url;

    const id = Number(rawId);
    const normalizedId = Number.isFinite(id) ? id : null;
    const url = typeof rawUrl === 'string' ? rawUrl.trim() : null;

    const idFromUrl = (() => {
      if (!url) return null;
      const match = url.match(/(?:^|\/)(\d+)(?:\/|$)/);
      if (!match?.[1]) return null;
      const parsed = Number(match[1]);
      return Number.isFinite(parsed) ? parsed : null;
    })();

    return {
      id: normalizedId ?? idFromUrl,
      url: url && url.length > 0 ? url : null,
    };
  } catch {
    const fallbackUrl = rawBody.trim();
    const match = fallbackUrl.match(/(?:^|\/)(\d+)(?:\/|$)/);
    const fallbackId = match?.[1] ? Number(match[1]) : null;
    return {
      id: Number.isFinite(fallbackId) ? fallbackId : null,
      url: fallbackUrl.length > 0 ? fallbackUrl : null,
    };
  }
}

async function uploadTravelImage(
  ctx: E2EApiContext,
  travelId: string | number,
  fileName: string,
): Promise<UploadedImage> {
  const api = await request.newContext({
    baseURL: ctx.apiBase,
    extraHTTPHeaders: {
      Authorization: `Token ${ctx.token}`,
    },
  });
  try {
    const uploadResp = await api.post(UPLOAD_PATH, {
      multipart: {
        file: liveUploadImage(fileName),
        collection: 'gallery',
        id: String(travelId),
      },
    });
    expect(uploadResp.ok(), `Gallery upload returned HTTP ${uploadResp.status()}`).toBe(true);
    const rawBody = await uploadResp.text();
    const parsed = parseUploadResponse(rawBody);
    expect(parsed.id, 'Gallery upload must return a positive image ID').toBeGreaterThan(0);
    expect(parsed.url, 'Gallery upload must return an HTTP image URL').toMatch(/^https?:\/\//);
    if (!parsed.id || !parsed.url) {
      throw new Error('Gallery upload did not return its image ID and URL');
    }
    return {
      id: parsed.id,
      url: parsed.url,
    };
  } finally {
    await api.dispose();
  }
}

test.describe('Travel persistence', () => {
  test('creates travel with filled fields and keeps them after reopen', async ({ page, createdTravels }) => {
    const ctx = await apiContextFromEnv().catch(() => null);
    expect(ctx, 'Live-contract API auth context is required for persistence').toBeTruthy();
    if (!ctx) throw new Error('Live-contract API auth context is unavailable');

    const filtersApi = await apiRequestContext(ctx);
    let filters: AnyRecord;
    let countriesRaw: unknown;
    try {
      const [filtersResponse, countriesResponse] = await Promise.all([
        filtersApi.get('/api/getFiltersTravel/'),
        filtersApi.get('/api/countries/'),
      ]);
      expect(filtersResponse.ok(), 'Travel reference dictionaries must load').toBe(true);
      expect(countriesResponse.ok(), 'Country references must load').toBe(true);
      filters = await filtersResponse.json() as AnyRecord;
      countriesRaw = await countriesResponse.json();
    } finally {
      await filtersApi.dispose();
    }

    const countries = Array.isArray(countriesRaw)
      ? countriesRaw
      : countriesRaw && typeof countriesRaw === 'object'
        ? (countriesRaw as AnyRecord).results ?? (countriesRaw as AnyRecord).data
        : [];
    const countryId = pickFirstId(countries);
    expect(countryId, 'A real country reference is required for persistence').not.toBeNull();
    if (countryId === null) throw new Error('Local country reference data is missing');
    const categoryId = pickFirstId(filters.categories);
    const pointCategoryId = pickFirstId(filters.categoryTravelAddress);
    expect(pointCategoryId, 'A real route-point category is required for persistence').not.toBeNull();
    if (pointCategoryId === null) throw new Error('Local route-point category data is missing');
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

    const payload = {
      id: null,
      name: travelName,
      description,
      countries: [countryId],
      cities: [],
      over_nights_stay: overnightId ? [overnightId] : [],
      complexity: complexityId ? [complexityId] : [],
      companions: companionId ? [companionId] : [],
      recommendation,
      plus,
      minus,
      youtube_link: youtube,
      gallery: [],
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
      travelImageThumbUrArr: [],
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
      travel_image_thumb_url: null,
      travel_image_thumb_small_url: null,
    };

    const created = await createOrUpdateTravel(ctx, payload);
    const travelId = created?.id;
    expect(travelId, 'Upsert did not return travel id').toBeTruthy();
    createdTravels.add(travelId);

    const uploadedImages = [
      await uploadTravelImage(ctx, travelId, `gallery-1-${unique}.webp`),
      await uploadTravelImage(ctx, travelId, `gallery-2-${unique}.webp`),
    ];
    const galleryIds = uploadedImages.map((img) => img.id);
    const coverUrl = uploadedImages[0].url;

    await createOrUpdateTravel(ctx, {
      ...payload,
      id: travelId,
      gallery: uploadedImages.map((img) => ({ id: img.id, url: img.url })),
      thumbs200ForCollectionArr: galleryIds,
      travelImageThumbUrlArr: galleryIds,
      travelImageThumbUrArr: galleryIds,
      travelImageAddress: galleryIds,
      coordsMeTravel: [
        {
          id: null,
          lat: 53.90454,
          lng: 27.56152,
          country: Number(countryId),
          address: 'Minsk center',
          categories: [Number(pointCategoryId)],
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
    expect(pickFirstId(readback?.countries)).toBe(countryId);

    const galleryFromRead = normalizeGalleryUrls(readback?.gallery);
    expect(galleryFromRead.length).toBeGreaterThanOrEqual(2);

    const reversedImages = [...uploadedImages].reverse();
    const reversedIds = reversedImages.map((img) => img.id);
    await reorderGalleryApi(ctx, travelId, reversedIds);

    const reorderedReadback = await readTravel(ctx, travelId);
    expect(normalizeGalleryIds(reorderedReadback?.gallery).slice(0, 2)).toEqual(reversedIds);

    const routeFromRead = Array.isArray(readback?.coordsMeTravel) ? readback.coordsMeTravel : [];
    expect(routeFromRead).toHaveLength(1);
    const [persistedPoint] = routeFromRead;
    expect(persistedPoint.address).toBe('Minsk center');
    expect(Number(persistedPoint.country)).toBe(Number(countryId));
    const pointCategories = Array.isArray(persistedPoint.categories) ? persistedPoint.categories.map(Number) : [];
    expect(pointCategories).toEqual([Number(pointCategoryId)]);

    const editUrl = `/travel/${travelId}`;
    const wizardFixture = { id: travelId };
    await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await selectStep(page, wizardFixture, 1);
    const nameInput = page.locator('#field-name').getByRole('textbox');
    await expect(nameInput, 'Seeded owner must be able to open the edit wizard').toBeVisible({ timeout: 30_000 });
    await expect(nameInput).toHaveValue(travelName, { timeout: 60_000 });

    await selectStep(page, wizardFixture, 3);

    await expect(page.getByText('Галерея путешествия').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByPlaceholder('Введите ссылку на YouTube')).toHaveValue(youtube, { timeout: 30_000 });
    await expect(page.getByTestId('gallery-image')).toHaveCount(2, { timeout: 30_000 });

    await page.goto('/metravel', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });

    await selectStep(page, wizardFixture, 1);
    await expect(nameInput).toHaveValue(travelName, { timeout: 60_000 });
    await selectStep(page, wizardFixture, 3);
    await expect(page.getByPlaceholder('Введите ссылку на YouTube')).toHaveValue(youtube, { timeout: 30_000 });
    await expect(page.getByTestId('gallery-image')).toHaveCount(2, { timeout: 30_000 });
  });

  test('persists gallery order via the dedicated reorder endpoint', async ({ createdTravels }) => {
    const ctx = await apiContextFromEnv().catch(() => null);
    expect(ctx, 'Live-contract API auth context is required for gallery reorder').toBeTruthy();
    if (!ctx) throw new Error('Live-contract API auth context is unavailable');

    const unique = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const created = await createOrUpdateTravel(ctx, {
      id: null,
      name: `E2E reorder ${unique}`,
      description: 'Gallery reorder endpoint check',
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
      year: '2026',
      budget: '',
      number_peoples: '2',
      number_days: '3',
      visa: false,
      publish: false,
      moderation: false,
    });
    const travelId = created?.id;
    expect(travelId, 'Upsert did not return travel id').toBeTruthy();
    createdTravels.add(travelId);

    const uploaded = await Promise.all([
      uploadTravelImage(ctx, travelId, `reorder-1-${unique}.webp`),
      uploadTravelImage(ctx, travelId, `reorder-2-${unique}.webp`),
    ]);

    expect(uploaded, 'Two uploaded images are required to verify gallery ordering').toHaveLength(2);

    const reversedIds = [...uploaded].reverse().map((img) => img.id);

    const reorderResponse = await reorderGalleryApi(ctx, travelId, reversedIds);
    const responseIds = (reorderResponse?.gallery ?? []).map((item) => item.id);
    expect(responseIds.slice(0, 2)).toEqual(reversedIds);
    for (const item of reorderResponse.gallery) {
      expect(Number.isFinite(item.order)).toBe(true);
    }

    const readback = await readTravel(ctx, travelId);
    expect(normalizeGalleryIds(readback?.gallery).slice(0, 2)).toEqual(reversedIds);
  });
});
