import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth';
import { seedNecessaryConsent } from './helpers/storage';

const TRAVEL_ID = 1603;
const POINT_ID = 501;
const POINT_PHOTO_URL = 'https://e2e.invalid/point-photo-501.jpg';
const CONTROL_PHOTO_URL = 'https://e2e.invalid/point-photo-502.jpg';

const ORIGINAL_POINT = {
  id: POINT_ID,
  lat: 49.841952,
  lng: 24.031592,
  country: 804,
  address: 'Площадь Рынок, Львов',
  categories: [7],
  image: null,
};

const tinyPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
  'base64',
);

type UploadRecord = {
  collection: string;
  filename: string;
  id: string;
};

type MockState = {
  reverseGeocodes: number;
  uploads: UploadRecord[];
  upserts: Array<Record<string, any>>;
};

type BrowserTelemetry = {
  consoleErrors: string[];
  failedRequests: string[];
  httpErrors: string[];
};

const multipartField = (body: string, field: string): string => {
  const match = body.match(new RegExp(`name="${field}"\\r?\\n\\r?\\n([^\\r\\n]+)`));
  return match?.[1]?.trim() ?? '';
};

const multipartFilename = (body: string): string => {
  const match = body.match(/name="file";\s*filename="([^"]+)"/i);
  return match?.[1]?.trim() ?? '';
};

const installWizardMocks = async (page: Page): Promise<MockState> => {
  const state: MockState = { reverseGeocodes: 0, uploads: [], upserts: [] };

  await ensureAuthedStorageFallback(page, { userId: '1', userName: 'E2E User' });
  await mockFakeAuthApis(page);
  await page.addInitScript(seedNecessaryConsent);
  await page.addInitScript((travelId: number) => {
    try {
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith('metravel_travel_draft_'))
        .forEach((key) => window.localStorage.removeItem(key));
      window.localStorage.setItem(
        `metravel_travel_wizard_step_${travelId}`,
        JSON.stringify({ step: 2, timestamp: Date.now(), schemaVersion: 1 }),
      );
    } catch {
      // Storage may be unavailable in a hardened browser context.
    }

    (window as typeof window & {
      __METRAVEL_E2E_EXIF_GPS__?: { lat: number; lng: number };
    }).__METRAVEL_E2E_EXIF_GPS__ = { lat: 50.06143, lng: 19.93658 };
  }, TRAVEL_ID);

  const filters = {
    categories: [{ id: 1, name: 'Город' }],
    transports: [{ id: 1, name: 'Пешком' }],
    companions: [{ id: 1, name: 'Соло' }],
    complexity: [{ id: 1, name: 'Легко' }],
    month: [{ id: 1, name: 'Январь' }],
    over_nights_stay: [{ id: 1, name: 'Отель' }],
    categoryTravelAddress: [{ id: 7, name: 'Достопримечательность' }],
    sortings: [
      {
        id: 'created-desc',
        name: 'Сначала новые',
        sortBy: 'created_at',
        sortOrder: 'desc',
      },
    ],
  };
  const countries = [
    { country_id: 804, title_ru: 'Украина', country_code: 'UA' },
    { country_id: 616, title_ru: 'Польша', country_code: 'PL' },
  ];

  await page.route(/\/(?:api\/)?getFiltersTravel\/(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(filters),
    });
  });
  await page.route(/\/(?:api\/)?countries\/(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(countries),
    });
  });
  await page.route('**/proxy/tiles/osm/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: tinyPngBuffer,
    });
  });

  await page.route(
    new RegExp(`/(?:api/)?travels/${TRAVEL_ID}/(?:\\?.*)?$`),
    async (route) => {
      if (route.request().method().toUpperCase() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: TRAVEL_ID,
          slug: 'e2e-point-photo-isolation',
          name: 'E2E portal photo isolation',
          description: 'Сохранённое путешествие для проверки редактора фотографии точки.',
          recommendation: '',
          plus: '',
          minus: '',
          youtube_link: '',
          userIds: '1',
          user: { id: 1, name: 'E2E User' },
          countries: [{ country_id: 804, title_ru: 'Украина' }],
          categories: [],
          transports: [],
          companions: [],
          complexity: [],
          month: [],
          over_nights_stay: [],
          cities: [],
          gallery: [],
          travelAddress: [],
          coordsMeTravel: [ORIGINAL_POINT],
          travel_image_thumb_url: '',
          travel_image_thumb_small_url: '',
          publish: false,
          moderation: false,
          visa: false,
          year: '2026',
          number_days: 1,
          number_peoples: 1,
        }),
      });
    },
  );
  await page.route(
    new RegExp(`/(?:api/)?travels/${TRAVEL_ID}/routes/(?:\\?.*)?$`),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    },
  );

  await page.route(/\/(?:api\/)?travels\/upsert\/(?:\?.*)?$/, async (route) => {
    const method = route.request().method().toUpperCase();
    if (method !== 'PUT' && method !== 'POST') {
      await route.fallback();
      return;
    }

    const raw = route.request().postData();
    const requestBody = raw ? JSON.parse(raw) : {};
    const payload = requestBody?.data ?? requestBody;
    state.upserts.push(payload);

    const coords = Array.isArray(payload?.coordsMeTravel)
      ? payload.coordsMeTravel.map((point: Record<string, any>, index: number) => ({
          ...point,
          id: point.id ?? POINT_ID + index,
        }))
      : [];

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...payload, id: TRAVEL_ID, coordsMeTravel: coords }),
    });
  });

  await page.route(/\/(?:api\/)?upload\/?(?:\?.*)?$/, async (route) => {
    if (route.request().method().toUpperCase() !== 'POST') {
      await route.fallback();
      return;
    }

    const body = route.request().postDataBuffer()?.toString('utf8') ?? '';
    const record = {
      collection: multipartField(body, 'collection'),
      filename: multipartFilename(body),
      id: multipartField(body, 'id'),
    };
    state.uploads.push(record);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        url: record.id === String(POINT_ID) ? POINT_PHOTO_URL : CONTROL_PHOTO_URL,
      }),
    });
  });

  await page.route('https://e2e.invalid/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: tinyPngBuffer,
    });
  });
  await page.route('https://nominatim.openstreetmap.org/reverse**', async (route) => {
    state.reverseGeocodes += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        display_name: 'Рыночная площадь, Краков, Польша',
        name: 'Рыночная площадь',
        address: { country: 'Польша', country_code: 'pl', city: 'Краков' },
      }),
    });
  });

  return state;
};

const dispatchJpegDrop = async (target: Locator, filename: string): Promise<void> => {
  const dataTransfer = await target.evaluateHandle((_element, name) => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], name, {
        type: 'image/jpeg',
      }),
    );
    return transfer;
  }, filename);

  try {
    await target.dispatchEvent('dragenter', { dataTransfer });
    await target.dispatchEvent('dragover', { dataTransfer });
    await target.dispatchEvent('drop', { dataTransfer });
  } finally {
    await dataTransfer.dispose();
  }
};

const installBrowserTelemetry = (page: Page): BrowserTelemetry => {
  const telemetry: BrowserTelemetry = {
    consoleErrors: [],
    failedRequests: [],
    httpErrors: [],
  };
  page.on('console', (message) => {
    if (message.type() === 'error') telemetry.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => telemetry.consoleErrors.push(error.message));
  page.on('requestfailed', (request) => {
    telemetry.failedRequests.push(
      `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'unknown error'}`,
    );
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      telemetry.httpErrors.push(
        `${response.request().method()} ${response.url()} — ${response.status()}`,
      );
    }
  });
  return telemetry;
};

test.describe('#1603 point-photo portal drop isolation', () => {
  // Mobile web intentionally exposes picker inputs and sets react-dropzone's
  // `noDrag`; DataTransfer coverage therefore belongs to the desktop surface.
  test.use({ viewport: { width: 1440, height: 900 } });

  test('modal drop updates the saved point without creating another point', async ({ page }, testInfo) => {
    const telemetry = installBrowserTelemetry(page);
    const evidenceDir = resolve('.codex-temp/task-1603');
    await mkdir(evidenceDir, { recursive: true });

    const state = await installWizardMocks(page);

    await page.goto(`/travel/${TRAVEL_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/^Точек:\s*1$/)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });

    await page
      .locator('#marker-0')
      .getByRole('button', { name: 'Редактировать', exact: true })
      .click();
    const imageField = page.getByText('Изображение точки', { exact: true }).locator('..');
    const modalEditor = imageField.locator('..');
    const modalFileInput = imageField.locator('input[type="file"]');
    await expect(modalFileInput).toBeAttached({ timeout: 15_000 });

    await dispatchJpegDrop(modalFileInput.locator('..'), 'portal-point.jpg');

    await expect.poll(() => state.uploads.length, { timeout: 15_000 }).toBe(1);
    expect(state.uploads[0]).toEqual({
      collection: 'travelImageAddress',
      filename: 'portal-point.jpg',
      id: String(POINT_ID),
    });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect(state.reverseGeocodes).toBe(0);
    await expect(page.getByText(/^Точек:\s*1$/)).toBeVisible();

    await modalEditor.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByText('Изображение точки', { exact: true })).toBeHidden();
    await expect
      .poll(
        () =>
          state.upserts.some((payload) => {
            const points = payload?.coordsMeTravel;
            return (
              Array.isArray(points) &&
              points.length === 1 &&
              String(points[0]?.id) === String(POINT_ID) &&
              points[0]?.image === POINT_PHOTO_URL
            );
          }),
        { timeout: 15_000 },
      )
      .toBe(true);

    const modalSavePayload = [...state.upserts].reverse().find((payload) => {
      const points = payload?.coordsMeTravel;
      return Array.isArray(points) && points.length === 1 && points[0]?.image === POINT_PHOTO_URL;
    });
    const savedPoint = modalSavePayload?.coordsMeTravel?.[0];
    expect(modalSavePayload?.coordsMeTravel).toHaveLength(1);
    expect({
      id: savedPoint?.id,
      lat: savedPoint?.lat,
      lng: savedPoint?.lng,
      country: savedPoint?.country,
      address: savedPoint?.address,
      categories: savedPoint?.categories,
    }).toEqual({
      id: ORIGINAL_POINT.id,
      lat: ORIGINAL_POINT.lat,
      lng: ORIGINAL_POINT.lng,
      country: ORIGINAL_POINT.country,
      address: ORIGINAL_POINT.address,
      categories: ORIGINAL_POINT.categories,
    });
    expect(state.reverseGeocodes).toBe(0);
    expect(state.uploads).toHaveLength(1);
    await page.screenshot({
      path: resolve(evidenceDir, 'portal-drop-keeps-one-point.png'),
      fullPage: true,
    });

    const upsertCountBeforePanelDrop = state.upserts.length;
    const uploadCountBeforePanelDrop = state.uploads.length;
    const panelDropZone = page.getByRole('button', { name: /Добавить точки из фото/i });
    await expect(panelDropZone).toBeVisible();
    await dispatchJpegDrop(panelDropZone, 'normal-panel-control.jpg');

    await expect(page.getByText(/^Точек:\s*2$/)).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => state.reverseGeocodes, { timeout: 15_000 }).toBe(1);
    await expect
      .poll(
        () =>
          state.upserts
            .slice(upsertCountBeforePanelDrop)
            .some((payload) => payload?.coordsMeTravel?.length === 2),
        { timeout: 15_000 },
      )
      .toBe(true);
    await expect
      .poll(() => state.uploads.length, { timeout: 15_000 })
      .toBe(uploadCountBeforePanelDrop + 1);

    expect(state.uploads[uploadCountBeforePanelDrop]).toEqual({
      collection: 'travelImageAddress',
      filename: 'normal-panel-control.jpg',
      id: String(POINT_ID + 1),
    });

    const panelDropPayloads = state.upserts.slice(upsertCountBeforePanelDrop);
    expect(panelDropPayloads.some((payload) => payload?.coordsMeTravel?.length === 2)).toBe(true);
    expect(
      panelDropPayloads.every((payload) => payload?.coordsMeTravel?.length === 2),
    ).toBe(true);
    expect(state.reverseGeocodes).toBe(1);
    expect(state.uploads).toHaveLength(2);
    await expect(page.getByText(/^Точек:\s*2$/)).toBeVisible();
    await page.screenshot({
      path: resolve(evidenceDir, 'panel-drop-adds-one-point.png'),
      fullPage: true,
    });
    await testInfo.attach('portal-drop-keeps-one-point', {
      path: resolve(evidenceDir, 'portal-drop-keeps-one-point.png'),
      contentType: 'image/png',
    });
    await testInfo.attach('panel-drop-adds-one-point', {
      path: resolve(evidenceDir, 'panel-drop-adds-one-point.png'),
      contentType: 'image/png',
    });
    expect(telemetry.httpErrors).toEqual([]);
    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.failedRequests).toEqual([]);
  });
});

test.describe('#1603 point-photo mobile picker isolation', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('picker upload keeps the saved point identity and count', async ({ page }, testInfo) => {
    const telemetry = installBrowserTelemetry(page);
    const evidenceDir = resolve('.codex-temp/task-1603');
    await mkdir(evidenceDir, { recursive: true });
    const state = await installWizardMocks(page);

    await page.goto(`/travel/${TRAVEL_ID}`, { waitUntil: 'domcontentloaded' });
    const showPointsButton = page.getByRole('button', { name: /^Показать точки \(1\)$/i });
    await expect(showPointsButton).toBeVisible({ timeout: 30_000 });
    await showPointsButton.click();

    const markerCard = page.locator('#marker-0');
    await expect(markerCard).toBeVisible({ timeout: 30_000 });
    await markerCard.getByRole('button', { name: 'Редактировать', exact: true }).click();

    const imageField = page.getByText('Изображение точки', { exact: true }).locator('..');
    const modalEditor = imageField.locator('..');
    const modalFileInput = imageField.getByTestId('photo-upload-mobile-gallery-input');
    await expect(modalFileInput).toBeAttached({ timeout: 15_000 });
    await modalFileInput.setInputFiles({
      name: 'mobile-picker-point.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });

    await expect.poll(() => state.uploads.length, { timeout: 15_000 }).toBe(1);
    expect(state.uploads[0]).toEqual({
      collection: 'travelImageAddress',
      filename: 'mobile-picker-point.jpg',
      id: String(POINT_ID),
    });
    expect(state.reverseGeocodes).toBe(0);
    await expect(page.locator('#markers-list-panel [id^="marker-"]')).toHaveCount(1);

    await modalEditor.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByText('Изображение точки', { exact: true })).toBeHidden();
    await expect
      .poll(
        () =>
          state.upserts.some((payload) => {
            const points = payload?.coordsMeTravel;
            return (
              Array.isArray(points) &&
              points.length === 1 &&
              String(points[0]?.id) === String(POINT_ID) &&
              points[0]?.image === POINT_PHOTO_URL
            );
          }),
        { timeout: 15_000 },
      )
      .toBe(true);

    const mobileSavePayload = [...state.upserts].reverse().find((payload) => {
      const points = payload?.coordsMeTravel;
      return (
        Array.isArray(points) &&
        points.length === 1 &&
        String(points[0]?.id) === String(POINT_ID) &&
        points[0]?.image === POINT_PHOTO_URL
      );
    });
    const savedPoint = mobileSavePayload?.coordsMeTravel?.[0];
    expect(mobileSavePayload?.coordsMeTravel).toHaveLength(1);
    expect({
      id: savedPoint?.id,
      lat: savedPoint?.lat,
      lng: savedPoint?.lng,
      country: savedPoint?.country,
      address: savedPoint?.address,
      categories: savedPoint?.categories,
    }).toEqual({
      id: ORIGINAL_POINT.id,
      lat: ORIGINAL_POINT.lat,
      lng: ORIGINAL_POINT.lng,
      country: ORIGINAL_POINT.country,
      address: ORIGINAL_POINT.address,
      categories: ORIGINAL_POINT.categories,
    });
    expect(state.reverseGeocodes).toBe(0);
    expect(state.uploads).toHaveLength(1);
    await expect(page.locator('#markers-list-panel [id^="marker-"]')).toHaveCount(1);
    await page.screenshot({
      path: resolve(evidenceDir, 'mobile-picker-keeps-one-point.png'),
      fullPage: true,
    });
    await testInfo.attach('mobile-picker-keeps-one-point', {
      path: resolve(evidenceDir, 'mobile-picker-keeps-one-point.png'),
      contentType: 'image/png',
    });
    expect(telemetry.httpErrors).toEqual([]);
    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.failedRequests).toEqual([]);
  });
});
