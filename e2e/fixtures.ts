import { test as base, expect, request } from '@playwright/test';
import { apiContextFromEnv, apiContextFromTracker, installCreatedTravelsTracker } from './helpers/e2eApi';

export const test = base.extend<{
  createdTravels: Set<string | number>;
}>({
  createdTravels: [
    async ({ page }, runFixture) => {
      const tracker = installCreatedTravelsTracker(page);
      try {
        await runFixture(tracker.ids);
      } finally {
        tracker.dispose();

        const ctxFromEnv = await apiContextFromEnv().catch(() => null);
        const ctx =
          ctxFromEnv ??
          apiContextFromTracker({
            apiBase: tracker.getApiBase?.() ?? null,
            token: tracker.getToken?.() ?? null,
          });
        if (ctx) {
          const cleanupTimeoutMs = Number(process.env.E2E_API_CLEANUP_TIMEOUT_MS || 20_000);
          const cleanupBudgetMs = Number(process.env.E2E_API_CLEANUP_BUDGET_MS || 60_000);
          const concurrency = Math.max(1, Math.min(3, Number(process.env.E2E_API_CLEANUP_CONCURRENCY || 2)));

          const deadline = Date.now() + cleanupBudgetMs;
          const ids = Array.from(tracker.ids);
          if (ids.length > 0) {
            const api = await request
              .newContext({
                baseURL: ctx.apiBase,
                timeout: cleanupTimeoutMs,
                extraHTTPHeaders: {
                  Authorization: `Token ${ctx.token}`,
                  'Content-Type': 'application/json',
                },
              })
              .catch(() => null);

            if (api) {
              try {
                let index = 0;
                const nextId = () => {
                  if (Date.now() >= deadline) return null;
                  const id = ids[index];
                  index += 1;
                  return id ?? null;
                };

                const deleteOne = async (id: string | number) => {
                  const remaining = deadline - Date.now();
                  if (remaining <= 0) return;
                  const timeout = Math.max(1, Math.min(cleanupTimeoutMs, remaining));
                  await api
                    .delete(`/api/travels/${id}/`, { timeout })
                    .then((resp) => {
                      // Best-effort cleanup; accept 404 if it was already deleted.
                      if (resp.ok()) return;
                      if (resp.status() === 404) return;
                    })
                    .catch(() => undefined);
                };

                const workers = Array.from({ length: Math.min(concurrency, ids.length) }, async () => {
                  while (true) {
                    const id = nextId();
                    if (id == null) break;
                    await deleteOne(id);
                  }
                });

                await Promise.race([
                  Promise.all(workers),
                  new Promise<void>((resolve) => setTimeout(resolve, cleanupBudgetMs)),
                ]);
              } finally {
                await api.dispose().catch(() => undefined);
              }
            }
          }
        }
      }
    },
    { auto: true },
  ],
});

export { expect };
