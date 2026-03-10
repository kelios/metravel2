import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';
import { apiContextFromEnv, apiRequestContext, deleteTravel, loginAsUser } from './helpers/e2eApi';

/**
 * E2E test: drag-drop image upload in ArticleEditor (description field).
 * Requires existing e2e auth env handled by helpers/e2eApi.ts.
 */

const UPSERT_TRAVEL = '/api/travels/upsert/';
const TRAVEL_BASE = '/api/travels';

// 1x1 PNG pixel
const tinyPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';

const basePayload = {
  id: null,
  name: 'E2E Travel for Editor Drop Test',
  description: '<p>Initial description</p>',
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

test.describe('ArticleEditor drag-drop image upload', () => {
  test('uploads image via drag-drop and inserts into editor', async ({ page, baseURL }) => {
    const targetBase = baseURL ?? process.env.BASE_URL;
    expect(targetBase).toBeTruthy();
    const ctx = await apiContextFromEnv();
    expect(ctx, 'E2E API context is required for ArticleEditor drag-drop image upload').toBeTruthy();
    if (!ctx) return;

    const apiContext = await apiRequestContext(ctx);
    const createResp = await apiContext.put(UPSERT_TRAVEL, { data: { ...basePayload } });
    expect(createResp.ok()).toBeTruthy();
    const created = await createResp.json();
    const travelId = created.id;
    expect(travelId).toBeTruthy();

    try {
      await loginAsUser(page);
      await preacceptCookies(page);

      // Navigate to travel edit page
      await page.goto(`${targetBase}/travel/${travelId}`);
      await page.waitForLoadState('networkidle');

      // Wait for Quill editor to load
      const editorSelector = '.ql-editor';
      await page.waitForSelector(editorSelector, { timeout: 15000 });

      // Get the editor element
      const editor = page.locator(editorSelector).first();
      await expect(editor).toBeVisible();

      // Count initial images in editor
      const initialImageCount = await editor.locator('img').count();

      // Create a DataTransfer with the image file
      const dataTransfer = await page.evaluateHandle((base64) => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const file = new File([bytes], 'test-drop.png', { type: 'image/png' });

        const dt = new DataTransfer();
        dt.items.add(file);
        return dt;
      }, tinyPngBase64);

      // Listen for network requests to /upload
      const uploadPromise = page.waitForResponse(
        (response) => response.url().includes('/upload') && response.request().method() === 'POST',
        { timeout: 30000 }
      );

      // Dispatch drop event on the editor
      await editor.dispatchEvent('drop', { dataTransfer });

      // Wait for upload request to complete
      const uploadResponse = await uploadPromise;
      expect(uploadResponse.ok()).toBeTruthy();

      // Parse response to verify URL is returned
      const responseBody = await uploadResponse.text();
      expect(responseBody.length).toBeGreaterThan(0);

      let imageUrl: string | undefined;
      try {
        const parsed = JSON.parse(responseBody);
        imageUrl = parsed?.url || parsed?.data?.url || parsed?.path || parsed?.file_url;
      } catch {
        imageUrl = responseBody.trim();
      }

      expect(imageUrl).toBeTruthy();
      expect(imageUrl?.startsWith('http')).toBeTruthy();

      // Wait for image to be inserted into editor
      await page.waitForFunction(
        ({ selector, initialCount }) => {
          const editor = document.querySelector(selector);
          if (!editor) return false;
          const images = editor.querySelectorAll('img');
          return images.length > initialCount;
        },
        { selector: editorSelector, initialCount: initialImageCount },
        { timeout: 10000 }
      );

      // Verify image was inserted
      const finalImageCount = await editor.locator('img').count();
      expect(finalImageCount).toBeGreaterThan(initialImageCount);

      // Verify the inserted image has the correct src
      const insertedImage = editor.locator('img').last();
      const src = await insertedImage.getAttribute('src');
      expect(src).toBeTruthy();
      expect(src?.startsWith('http')).toBeTruthy();
    } finally {
      await deleteTravel(ctx, travelId).catch(() => undefined);
      await apiContext.dispose();
    }
  });

  test('shows error when not authenticated', async ({ page, baseURL }) => {
    const targetBase = baseURL ?? process.env.BASE_URL;
    expect(targetBase).toBeTruthy();
    const ctx = await apiContextFromEnv();
    expect(ctx, 'E2E API context is required for ArticleEditor unauthenticated image-drop test').toBeTruthy();
    if (!ctx) return;

    const apiContext = await apiRequestContext(ctx);
    const createResp = await apiContext.put(UPSERT_TRAVEL, { data: { ...basePayload } });
    expect(createResp.ok()).toBeTruthy();
    const created = await createResp.json();
    const travelId = created.id;

    try {
      await page.addInitScript(() => {
        try {
          window.localStorage.removeItem('secure_userToken');
          window.localStorage.removeItem('secure_userId');
          window.localStorage.removeItem('userToken');
          window.localStorage.removeItem('userId');
          window.localStorage.removeItem('isAuthenticated');
        } catch {
          // ignore
        }
      });

      // Navigate without auth
      await page.goto(`${targetBase}/travel/${travelId}`);
      await preacceptCookies(page);
      await page.waitForLoadState('networkidle');

      // Wait for editor
      const editorSelector = '.ql-editor';
      await page.waitForSelector(editorSelector, { timeout: 15000 });

      const editor = page.locator(editorSelector).first();
      await expect(editor).toBeVisible();

      // Create DataTransfer with image
      const dataTransfer = await page.evaluateHandle((base64) => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const file = new File([bytes], 'test-drop.png', { type: 'image/png' });
        const dt = new DataTransfer();
        dt.items.add(file);
        return dt;
      }, tinyPngBase64);

      // Dispatch drop event
      await editor.dispatchEvent('drop', { dataTransfer });

      // Should show auth error alert (or no upload request)
      // Wait a bit and verify no image was inserted
      await page.waitForTimeout(2000);

      const imageCount = await editor.locator('img').count();
      // Should not have any new images since user is not authenticated
      expect(imageCount).toBe(0);
    } finally {
      await deleteTravel(ctx, travelId).catch(() => undefined);
      await apiContext.dispose();
    }
  });
});
