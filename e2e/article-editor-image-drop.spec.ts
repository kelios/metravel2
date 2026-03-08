import { test, expect } from './fixtures';
import { request } from '@playwright/test';
import { preacceptCookies } from './helpers/navigation';

/**
 * E2E test: drag-drop image upload in ArticleEditor (description field).
 * Requires env:
 *   - E2E_EMAIL, E2E_PASSWORD (for login)
 *   - E2E_API_TOKEN (DRF Token for API calls)
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
    const token = process.env.E2E_API_TOKEN;
    const email = process.env.E2E_EMAIL;
    const password = process.env.E2E_PASSWORD;

    if (!token) {
      test.info().annotations.push({
        type: 'skip',
        description: 'E2E_API_TOKEN is required for this test',
      });
      test.skip();
      return;
    }

    const targetBase = baseURL ?? process.env.BASE_URL;
    expect(targetBase).toBeTruthy();

    // Create travel via API to get an ID
    const apiContext = await request.newContext({
      baseURL: targetBase,
      extraHTTPHeaders: {
        Authorization: `Token ${token}`,
      },
    });

    const createResp = await apiContext.put(UPSERT_TRAVEL, { data: { ...basePayload } });
    expect(createResp.ok()).toBeTruthy();
    const created = await createResp.json();
    const travelId = created.id;
    expect(travelId).toBeTruthy();

    try {
      // Set up auth in browser
      if (email && password) {
        await page.goto(`${targetBase}/`);
        await preacceptCookies(page);

        // Inject auth token into storage
        await page.evaluate(
          ({ token, email }) => {
            localStorage.setItem('userToken', token);
            localStorage.setItem('userEmail', email);
            localStorage.setItem('isAuthenticated', 'true');
          },
          { token, email }
        );
      }

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
      // Cleanup: delete the travel
      await apiContext.delete(`${TRAVEL_BASE}/${travelId}/`).catch(() => undefined);
      await apiContext.dispose();
    }
  });

  test('shows error when not authenticated', async ({ page, baseURL }) => {
    const token = process.env.E2E_API_TOKEN;

    if (!token) {
      test.info().annotations.push({
        type: 'skip',
        description: 'E2E_API_TOKEN is required for this test',
      });
      test.skip();
      return;
    }

    const targetBase = baseURL ?? process.env.BASE_URL;
    expect(targetBase).toBeTruthy();

    // Create travel via API
    const apiContext = await request.newContext({
      baseURL: targetBase,
      extraHTTPHeaders: {
        Authorization: `Token ${token}`,
      },
    });

    const createResp = await apiContext.put(UPSERT_TRAVEL, { data: { ...basePayload } });
    expect(createResp.ok()).toBeTruthy();
    const created = await createResp.json();
    const travelId = created.id;

    try {
      // Navigate without auth
      await page.goto(`${targetBase}/travel/${travelId}`);
      await preacceptCookies(page);
      await page.waitForLoadState('networkidle');

      // Clear any existing auth
      await page.evaluate(() => {
        localStorage.removeItem('userToken');
        localStorage.removeItem('isAuthenticated');
      });

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
      await apiContext.delete(`${TRAVEL_BASE}/${travelId}/`).catch(() => undefined);
      await apiContext.dispose();
    }
  });
});
