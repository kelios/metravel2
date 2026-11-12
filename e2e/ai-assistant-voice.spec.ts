import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';
import { runtimeViewport } from './helpers/runtimeViewport';

/**
 * #3351: голосовой ввод вопроса на `/assistant`. Распознаватель браузера подменён
 * управляемой заглушкой (`window.SpeechRecognition` и `webkitSpeechRecognition`),
 * реальный микрофон не нужен. Контракт: фраза попадает в поле, но вопрос уходит только
 * по «Спросить»; отказ в доступе объясняется строкой; без API распознавания кнопки нет.
 * Бандл собран с `EXPO_PUBLIC_AI_ASSISTANT=1`, иначе экрана нет и сценарий пропускается явно.
 * Подход к экрану — как в `e2e/ai-assistant-ask.spec.ts` (helpers там не экспортируются,
 * поэтому `waitForLiveInput` продублирован ниже).
 */
const SCREEN_TIMEOUT_MS = 30_000;
const VIEWPORT = runtimeViewport({ width: 1280, height: 720 });
const PHRASE = 'Какие квесты есть в Гродно';

type VoiceStubWindow = Window & {
  __e2eVoice?: { starts: number; emitFinal: (text: string) => void; emitError: (code: string) => void };
};

/** Заглушка распознавателя: тест шлёт итоговую фразу или ошибку через `window.__e2eVoice`. */
async function installSpeechStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Handler = ((event: unknown) => void) | null;
    let active: { onresult: Handler; onerror: Handler; onend: (() => void) | null } | null = null;
    const control = {
      starts: 0,
      emitFinal(text: string) {
        active?.onresult?.({ results: [{ 0: { transcript: text }, isFinal: true }], resultIndex: 0 });
      },
      emitError(code: string) {
        active?.onerror?.({ error: code });
      },
    };
    class StubRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: Handler = null;
      onerror: Handler = null;
      onend: (() => void) | null = null;
      start() {
        control.starts += 1;
        active = this;
      }
      stop() {
        this.onend?.();
      }
    }
    (window as unknown as VoiceStubWindow).__e2eVoice = control;
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, writable: true, value: StubRecognition });
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, writable: true, value: StubRecognition });
  });
}

/** Chromium имеет собственный `webkitSpeechRecognition`: «Firefox» = оба имени отсутствуют. */
async function removeSpeechApi(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, writable: true, value: undefined });
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, writable: true, value: undefined });
  });
}

/** Продублировано из `ai-assistant-ask.spec.ts`: экран ставит `data-live="true"` после монтирования. */
async function waitForLiveInput(page: Page): Promise<void> {
  await expect(
    page.locator('[data-testid="assistant-screen"][data-live="true"] [data-testid="assistant-input"]'),
  ).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
}

async function openAssistant(page: Page): Promise<void> {
  await page.setViewportSize(VIEWPORT);
  await preacceptCookies(page);
  await page.goto('/assistant', { waitUntil: 'domcontentloaded' });
  const shown = await page
    .getByTestId('assistant-screen')
    .waitFor({ state: 'visible', timeout: SCREEN_TIMEOUT_MS })
    .then(() => true)
    .catch(() => false);
  test.skip(!shown, 'бандл собран без EXPO_PUBLIC_AI_ASSISTANT');
  await waitForLiveInput(page);
}

const speechStarts = (page: Page) => page.evaluate(() => (window as unknown as VoiceStubWindow).__e2eVoice?.starts ?? -1);

test.describe('Assistant voice input (#3351)', () => {
  test('a dictated phrase lands in the field and POST /ai/ask leaves only after «Ask»', async ({ page }) => {
    const asks: Array<{ q?: string }> = [];
    await page.route('**/ai/ask', async (route) => {
      asks.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        body: [
          `event: sources\ndata: ${JSON.stringify({ sources: [], degraded: false, remaining: 19 })}\n\n`,
          `event: text\ndata: ${JSON.stringify({ text: 'Подходящих квестов нет.' })}\n\n`,
          `event: done\ndata: ${JSON.stringify({ status: 'done', removed_links: 0, usage: { prompt_tokens: 1, completion_tokens: 1, ttft_ms: 1, tokens_per_s: 1 }, remaining: 19 })}\n\n`,
        ].join(''),
      });
    });
    await installSpeechStub(page);
    await openAssistant(page);

    const voice = page.getByTestId('assistant-voice');
    await expect(voice).toBeVisible();
    await voice.click();
    await expect.poll(() => speechStarts(page), { timeout: SCREEN_TIMEOUT_MS }).toBe(1);

    await page.evaluate((text) => (window as unknown as VoiceStubWindow).__e2eVoice?.emitFinal(text), PHRASE);
    await expect(page.getByTestId('assistant-input')).toHaveValue(PHRASE);
    // Диктовка вопрос не отправляет: запроса нет, «Спросить» ждёт человека.
    expect(asks).toEqual([]);
    await expect(page.getByTestId('assistant-send')).toBeEnabled();

    await page.getByTestId('assistant-send').click();
    await expect(page.getByTestId('assistant-turn-done')).toBeVisible({ timeout: SCREEN_TIMEOUT_MS });
    expect(asks).toHaveLength(1);
    expect(asks[0]).toMatchObject({ q: PHRASE });
  });

  test('not-allowed shows the microphone-denied status and sends nothing', async ({ page }) => {
    const asks: string[] = [];
    await page.route('**/ai/ask', async (route) => {
      asks.push(route.request().url());
      await route.abort();
    });
    await installSpeechStub(page);
    await openAssistant(page);

    await page.getByTestId('assistant-voice').click();
    await expect.poll(() => speechStarts(page), { timeout: SCREEN_TIMEOUT_MS }).toBe(1);
    await page.evaluate(() => (window as unknown as VoiceStubWindow).__e2eVoice?.emitError('not-allowed'));

    const status = page.getByTestId('assistant-voice-status');
    await expect(status).toBeVisible();
    // Русская локаль по умолчанию, как в соседних сценариях ассистента.
    await expect(status).toContainText('микрофон');
    await expect(page.getByTestId('assistant-input')).toHaveValue('');
    expect(asks).toEqual([]);
  });

  test('without a speech recognition API there is no voice button', async ({ page }) => {
    await removeSpeechApi(page);
    await openAssistant(page);

    // Поле живое и «Спросить» на месте — значит, кнопки нет не из-за незагруженного экрана.
    await expect(page.getByTestId('assistant-send')).toBeVisible();
    await expect(page.getByTestId('assistant-voice')).toHaveCount(0);
  });
});
