import { Buffer } from 'node:buffer';
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { ensureAuthedStorageFallback, mockFakeAuthApis } from './helpers/auth';

const tinyPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
  'base64'
);

const uploadedImageUrl = 'https://example.com/e2e-editor-upload.png';
const upsertPatterns = [
  '**/api/travels/upsert/**',
  '**/api/travels/upsert/',
  '**/travels/upsert/**',
  '**/travels/upsert/',
];

async function maybeAcceptCookies(page: Page) {
  const candidates = [
    page.getByText('Принять всё', { exact: true }),
    page.getByText('Только необходимые', { exact: true }),
    page.getByRole('button', { name: /принять/i }).first(),
  ];

  for (const candidate of candidates) {
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click({ force: true }).catch(() => null);
      break;
    }
  }
}

async function mockTravelUpsert(page: Page) {
  let nextId = 7100;

  for (const pattern of upsertPatterns) {
    await page.route(pattern, async (route) => {
      const request = route.request();
      const method = request.method().toUpperCase();
      if (method !== 'PUT' && method !== 'POST') {
        await route.fallback();
        return;
      }

      let body: any = null;
      try {
        const raw = request.postData();
        body = raw ? JSON.parse(raw) : null;
      } catch {
        body = null;
      }

      const payload = body?.data ?? body ?? {};
      const id = payload?.id ?? nextId++;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...payload,
          id,
          name: payload?.name ?? 'E2E Article Editor Travel',
        }),
      });
    });
  }
}

async function mockImageUpload(page: Page) {
  await page.route('**/api/upload**', async (route) => {
    if (route.request().method().toUpperCase() !== 'POST') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: uploadedImageUrl }),
    });
  });
}

async function openWizard(page: Page) {
  await mockFakeAuthApis(page);
  await ensureAuthedStorageFallback(page);
  await mockTravelUpsert(page);
  await mockImageUpload(page);

  await page.goto('/travel/new', { waitUntil: 'domcontentloaded' });
  await maybeAcceptCookies(page);
  await expect(page.getByPlaceholder('Например: Неделя в Грузии')).toBeVisible({ timeout: 30_000 });
}

function getEditorActivationTarget(page: Page) {
  return page.locator('.ql-editor').first().or(page.getByText('Загрузка…').first());
}

async function ensureEditorLoaded(page: Page) {
  const target = getEditorActivationTarget(page);
  await expect(target).toBeVisible({ timeout: 15_000 });
  await target.click({ force: true });
  const editor = page.locator('.ql-editor').first();
  await expect(editor).toBeVisible({ timeout: 15_000 });
  return editor;
}

async function typeInEditor(page: Page, text: string) {
  const editor = await ensureEditorLoaded(page);
  await editor.click({ force: true });
  await page.keyboard.press('ControlOrMeta+A').catch(() => null);
  await page.keyboard.type(text, { delay: 15 });
  await expect.poll(async () => ((await editor.textContent()) || '').trim(), { timeout: 10_000 }).toContain(text);
  return editor;
}

async function selectAllEditorText(page: Page) {
  const editor = page.locator('.ql-editor').first();
  await editor.click({ force: true });
  await page.keyboard.press('ControlOrMeta+A');
}

test.describe('ArticleEditor browser actions', () => {
  test.beforeEach(async ({ page }) => {
    await openWizard(page);
    await page.getByPlaceholder('Например: Неделя в Грузии').fill('E2E Article Editor');
  });

  test('switches between rich text, HTML mode and fullscreen without losing content', async ({ page }) => {
    const text = 'Smoke editor text for html and fullscreen';
    await typeInEditor(page, text);

    const htmlToggle = page.getByRole('button', { name: /показать html-код/i }).first();
    await htmlToggle.click({ force: true });

    const htmlTextarea = page.locator('textarea').first();
    await expect(htmlTextarea).toBeVisible({ timeout: 10_000 });
    await expect(htmlTextarea).toHaveValue(/Smoke editor text for html and fullscreen/);

    const htmlValue = '<p><strong>HTML mode content</strong> keeps working</p>';
    await htmlTextarea.fill(htmlValue);

    const richTextToggle = page.getByRole('button', { name: /скрыть html-код/i }).first();
    await richTextToggle.click({ force: true });

    const editor = page.locator('.ql-editor').first();
    await expect.poll(async () => ((await editor.textContent()) || '').trim(), { timeout: 10_000 }).toContain(
      'HTML mode content keeps working'
    );

    const fullscreenButton = page.getByRole('button', { name: /полноэкранного режима/i }).first();
    await fullscreenButton.click({ force: true });
    await expect(page.getByRole('button', { name: /выйти из полноэкранного режима/i }).first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /выйти из полноэкранного режима/i }).first().click({ force: true });
    await expect(page.getByRole('button', { name: /перейти в полноэкранный режим/i }).first()).toBeVisible({ timeout: 10_000 });
    await expect(editor).toContainText('HTML mode content keeps working');
  });

  test('inserts anchor and keeps it in HTML mode', async ({ page }) => {
    await typeInEditor(page, 'Anchor content');

    const anchorButton = page.getByRole('button', { name: 'Вставить якорь' }).first();
    await anchorButton.click({ force: true });

    const anchorInput = page.getByPlaceholder('day-3').first();
    await expect(anchorInput).toBeVisible({ timeout: 10_000 });
    await anchorInput.fill('day-3');
    await page.getByRole('button', { name: 'Вставить', exact: true }).first().click({ force: true });

    await page.getByRole('button', { name: /показать html-код/i }).first().click({ force: true });
    const htmlTextarea = page.locator('textarea').first();
    await expect(htmlTextarea).toBeVisible({ timeout: 10_000 });
    await expect.poll(async () => await htmlTextarea.inputValue(), { timeout: 10_000 }).toMatch(/id="day-3"|\[#day-3\]/);
  });

  test('inserts a link through the toolbar modal', async ({ page }) => {
    await typeInEditor(page, 'Link target text');
    await selectAllEditorText(page);

    await page.locator('.ql-toolbar button.ql-link').first().click({ force: true });
    const linkInput = page.getByPlaceholder('https://...').first();
    await expect(linkInput).toBeVisible({ timeout: 10_000 });
    await linkInput.fill('https://example.com/editor-link');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).first().click({ force: true });

    await page.getByRole('button', { name: /показать html-код/i }).first().click({ force: true });
    const htmlTextarea = page.locator('textarea').first();
    await expect.poll(async () => await htmlTextarea.inputValue(), { timeout: 10_000 }).toContain('https://example.com/editor-link');
  });

  test('applies formatting, clears it, then undo and redo remain clickable and effective', async ({ page }) => {
    const editor = await typeInEditor(page, 'Bold me please');
    await selectAllEditorText(page);

    await page.locator('.ql-toolbar button.ql-bold').first().click({ force: true });
    await expect.poll(async () => await editor.innerHTML(), { timeout: 10_000 }).toMatch(/<strong>|<b>/i);

    await page.getByRole('button', { name: 'Очистить форматирование' }).first().click({ force: true });
    await expect.poll(async () => await editor.innerHTML(), { timeout: 10_000 }).not.toMatch(/<strong>|<b>/i);

    await page.getByRole('button', { name: 'Отменить последнее действие' }).first().click({ force: true });
    await expect.poll(async () => await editor.innerHTML(), { timeout: 10_000 }).toMatch(/<strong>|<b>/i);

    await page.getByRole('button', { name: 'Повторить действие' }).first().click({ force: true });
    await expect.poll(async () => await editor.innerHTML(), { timeout: 10_000 }).not.toMatch(/<strong>|<b>/i);
  });

  test('uploads image through the image button', async ({ page }) => {
    const editor = await ensureEditorLoaded(page);

    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Вставить изображение' }).first().click({ force: true });
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'editor-image-button.png',
      mimeType: 'image/png',
      buffer: tinyPngBuffer,
    });

    await expect.poll(async () => await editor.locator('img').count(), { timeout: 10_000 }).toBeGreaterThan(0);
    await expect(editor.locator('img').last()).toHaveAttribute('src', uploadedImageUrl);
  });

  test('uploads image through drag and drop even when Quill was not loaded yet', async ({ page }) => {
    const target = getEditorActivationTarget(page);
    await expect(target).toBeVisible({ timeout: 15_000 });

    const dataTransfer = await page.evaluateHandle((base64) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      const file = new File([bytes], 'drop-image.png', { type: 'image/png' });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      return transfer;
    }, tinyPngBuffer.toString('base64'));

    await target.dispatchEvent('dragenter', { dataTransfer });
    await target.dispatchEvent('dragover', { dataTransfer });
    await target.dispatchEvent('drop', { dataTransfer });

    const editor = page.locator('.ql-editor').first();
    await expect(editor).toBeVisible({ timeout: 15_000 });
    await expect.poll(async () => await editor.locator('img').count(), { timeout: 10_000 }).toBeGreaterThan(0);
    await expect(editor.locator('img').last()).toHaveAttribute('src', uploadedImageUrl);
  });
});
