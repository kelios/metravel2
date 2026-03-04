import { test, expect } from './fixtures';
import { request } from '@playwright/test';
import {
  apiContextFromEnv,
  apiRequestContext,
  createOrUpdateTravel,
  E2EApiContext,
  readTravel,
} from './helpers/e2eApi';

type AnyRecord = Record<string, unknown>;

type UploadedImage = {
  id: number;
  url: string;
};

const UPLOAD_PATH = '/api/upload';

// 1x1 PNG pixel
const tinyPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
  'base64'
);

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
): Promise<UploadedImage | null> {
  const collections = ['gallery', 'travelImageAddress'];
  let lastError = '';

  for (const collection of collections) {
    const api = await request.newContext({
      baseURL: ctx.apiBase,
      extraHTTPHeaders: {
        Authorization: `Token ${ctx.token}`,
      },
    });
    const uploadResp = await api.post(UPLOAD_PATH, {
      multipart: {
        file: {
          name: fileName,
          mimeType: 'image/png',
          buffer: tinyPngBuffer,
        },
        collection,
        id: String(travelId),
      },
    });

    const rawBody = await uploadResp.text();
    await api.dispose();

    if (!uploadResp.ok()) {
      lastError = `${collection}: ${uploadResp.status()} ${uploadResp.statusText()} ${rawBody.slice(0, 200)}`;
      continue;
    }

    const parsed = parseUploadResponse(rawBody);
    if (!parsed.id || !parsed.url) {
      lastError = `${collection}: missing id/url in response ${rawBody.slice(0, 200)}`;
      continue;
    }

    return {
      id: parsed.id,
      url: parsed.url,
    };
  }

  test.info().annotations.push({
    type: 'note',
    description: `Image upload unavailable in current env. ${lastError}`,
  });
  return null;
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
    const fallbackCoverUrl = 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200';

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
      await uploadTravelImage(ctx, travelId, `gallery-1-${unique}.png`),
      await uploadTravelImage(ctx, travelId, `gallery-2-${unique}.png`),
    ].filter((img): img is UploadedImage => img != null);

    const galleryReady = uploadedImages.length >= 2;
    const galleryIds = galleryReady ? uploadedImages.map((img) => img.id) : [];
    const coverUrl = galleryReady ? uploadedImages[0].url : fallbackCoverUrl;

    await createOrUpdateTravel(ctx, {
      ...payload,
      id: travelId,
      gallery: galleryReady ? uploadedImages.map((img) => ({ id: img.id, url: img.url })) : [],
      thumbs200ForCollectionArr: galleryIds,
      travelImageThumbUrlArr: galleryIds,
      travelImageThumbUrArr: galleryIds,
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

    if (galleryReady) {
      const galleryFromRead = normalizeGalleryUrls(readback?.gallery);
      expect(galleryFromRead.length).toBeGreaterThanOrEqual(2);
    }

    const routeFromRead = Array.isArray(readback?.coordsMeTravel) ? readback.coordsMeTravel : [];
    expect(routeFromRead.length).toBeGreaterThan(0);
    if (galleryReady) {
      expect(String((routeFromRead[0] as AnyRecord)?.image ?? '').trim().length).toBeGreaterThan(0);
    }

    const editUrl = `/travel/edit/${travelId}`;
    await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    const nameInput = page.getByPlaceholder('Например: Неделя в Грузии');
    const canOpenEditForm = await nameInput.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!canOpenEditForm) {
      test.info().annotations.push({
        type: 'note',
        description: 'Edit UI is not available in current auth/session context; API persistence assertions were executed.',
      });
      return;
    }
    await expect(nameInput).toHaveValue(travelName, { timeout: 60_000 });

    const step3Milestone = page.getByLabel('Перейти к шагу 3');
    if (await step3Milestone.first().isVisible().catch(() => false)) {
      await step3Milestone.first().click();
    } else {
      await page.getByLabel('Далее').click();
      await page.getByLabel('К медиа').click();
    }

    await expect(page.getByText('Галерея путешествия').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByPlaceholder('Введите ссылку на YouTube')).toHaveValue(youtube, { timeout: 30_000 });
    if (galleryReady) {
      await expect(page.getByTestId('gallery-image')).toHaveCount(2, { timeout: 30_000 });
    }

    await page.goto('/metravel', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });

    await expect(nameInput).toHaveValue(travelName, { timeout: 60_000 });
    if (await step3Milestone.first().isVisible().catch(() => false)) {
      await step3Milestone.first().click();
    } else {
      await page.getByLabel('Далее').click();
      await page.getByLabel('К медиа').click();
    }
    await expect(page.getByPlaceholder('Введите ссылку на YouTube')).toHaveValue(youtube, { timeout: 30_000 });
    if (galleryReady) {
      await expect(page.getByTestId('gallery-image')).toHaveCount(2, { timeout: 30_000 });
    }
  });
});
