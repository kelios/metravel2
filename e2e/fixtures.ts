import { test as base, expect } from '@playwright/test';
import { apiContextFromEnv, deleteTravel, installCreatedTravelsTracker } from './helpers/e2eApi';

export const test = base.extend<{
  createdTravels: Set<string | number>;
}>({
  createdTravels: async ({ page }, runFixture) => {
    const tracker = installCreatedTravelsTracker(page);
    try {
      await runFixture(tracker.ids);
    } finally {
      tracker.dispose();

      const ctx = await apiContextFromEnv().catch(() => null);
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
