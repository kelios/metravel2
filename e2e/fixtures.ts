import { test as base, expect } from '@playwright/test';
import { apiContextFromEnv, apiContextFromTracker, deleteTravel, installCreatedTravelsTracker } from './helpers/e2eApi';

export const test = base.extend<{
  createdTravels: Set<string | number>;
}>({
  createdTravels: async ({ page }, runFixture) => {
    const tracker = installCreatedTravelsTracker(page);
    try {
      await runFixture(tracker.ids);
    } finally {
      tracker.dispose();

      const ctxFromEnv = await apiContextFromEnv().catch(() => null);
      const ctx = ctxFromEnv ?? apiContextFromTracker({ apiBase: tracker.getApiBase?.() ?? null });
      if (ctx) {
        const ids = Array.from(tracker.ids);
        for (const id of ids) {
          await deleteTravel(ctx, id).catch(() => undefined);
        }
      }
    }
  },
});

export { expect };
