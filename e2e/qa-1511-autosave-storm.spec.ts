import { test, expect } from '@playwright/test';

/**
 * QA-замер для тикета #1511: непрерывная правка описания статьи не должна
 * порождать серию оборванных `PUT /travels/upsert/`.
 *
 * Прогон ручной и намеренно долгий (минута печати), поэтому в обычный набор он
 * не входит: включается переменной E2E_AUTOSAVE_STORM=1. Медленный сервер
 * эмулируется прокси-задержкой ответа на upsert (см. scratchpad-прокси в
 * отчёте по задаче) — без неё сохранение лёгкой статьи короче debounce и
 * условие «дебаунс сработал во время полёта» не возникает.
 *
 * TRAVEL_ID — черновик тестового аккаунта; прогон правит только его описание.
 */
const ENABLED = !!process.env.E2E_AUTOSAVE_STORM;
const TRAVEL_ID = process.env.E2E_AUTOSAVE_TRAVEL_ID || '726';
const TYPING_MS = Number(process.env.E2E_AUTOSAVE_TYPING_MS || 60_000);

type UpsertRecord = {
  index: number;
  startedAt: number;
  finishedAt?: number;
  status?: number;
  failure?: string;
};

test.describe('#1511 autosave upsert storm', () => {
  test.skip(!ENABLED, 'Ручной QA-замер: запускать с E2E_AUTOSAVE_STORM=1');
  test.setTimeout(TYPING_MS + 180_000);

  test('continuous typing keeps at most one in-flight upsert', async ({ page }) => {
    const records: UpsertRecord[] = [];
    const byRequest = new Map<unknown, UpsertRecord>();
    let maxConcurrent = 0;

    const isUpsert = (url: string) => url.includes('/travels/upsert/');

    page.on('request', (request) => {
      if (!isUpsert(request.url())) return;
      const record: UpsertRecord = { index: records.length + 1, startedAt: Date.now() };
      records.push(record);
      byRequest.set(request, record);
      const inFlight = records.filter((r) => r.finishedAt == null).length;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
    });
    page.on('requestfinished', async (request) => {
      const record = byRequest.get(request);
      if (!record) return;
      record.finishedAt = Date.now();
      record.status = (await request.response())?.status();
    });
    page.on('requestfailed', (request) => {
      const record = byRequest.get(request);
      if (!record) return;
      record.finishedAt = Date.now();
      record.failure = request.failure()?.errorText || 'failed';
    });

    await page.goto(`/travel/${TRAVEL_ID}`, { waitUntil: 'domcontentloaded' });

    // Куки-баннер закрываем самым приватным вариантом, чтобы он не перехватывал ввод.
    const decline = page
      .getByRole('button', { name: /только необходимые|отклонить|отказаться/i })
      .first();
    if (await decline.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await decline.click({ force: true }).catch(() => {});
    }

    const editor = page.locator('.ql-editor').first();
    await expect(editor).toBeVisible({ timeout: 120_000 });
    await editor.click();

    const started = Date.now();
    let typed = 0;
    while (Date.now() - started < TYPING_MS) {
      await page.keyboard.type(`#1511 ${typed} `, { delay: 40 });
      typed += 1;
    }

    // Даём последнему сохранению долететь.
    await page.waitForTimeout(30_000);

    const canceled = records.filter((r) => r.failure);
    const finished = records.filter((r) => r.status != null);
    const report = {
      typingSeconds: Math.round(TYPING_MS / 1000),
      upsertTotal: records.length,
      upsertFinished: finished.length,
      upsertCanceled: canceled.length,
      maxConcurrent,
      durations: records.map((r) => ({
        i: r.index,
        sec: r.finishedAt ? Number(((r.finishedAt - r.startedAt) / 1000).toFixed(2)) : null,
        status: r.status ?? r.failure,
      })),
    };
    console.log('[#1511 autosave report]', JSON.stringify(report, null, 2));

    expect(maxConcurrent, 'одновременно летящих upsert').toBeLessThanOrEqual(1);
    expect(canceled.length, 'оборванных клиентом upsert').toBe(0);
    expect(records.length, 'всего upsert за прогон').toBeLessThanOrEqual(finished.length + 1);
  });
});
