import { test as base, expect } from '@playwright/test'
import { FALLBACK_TRAVEL_ID } from '../helpers/navigation'
import {
  beginLocalCanonicalReplayLifecycle,
  finishLocalCanonicalReplayBoundaries,
  installLocalCanonicalReplayBoundary,
  isLocalCanonicalReplay,
} from '../helpers/localCanonicalReplay'

// Explicit LOCAL-only replay mode. Normal E2E targets and their safety gate stay intact.
export const test = base.extend<{ localCanonicalReplayBoundary: void }>({
  // A cached shared fixture must carry its policy to every importing file suite.
  serviceWorkers: async ({ serviceWorkers }, provide) => {
    await provide(isLocalCanonicalReplay() ? 'block' : serviceWorkers)
  },
  localCanonicalReplayBoundary: [async ({ context, baseURL }, provide) => {
    if (!isLocalCanonicalReplay()) { await provide(); return }
    const owner = beginLocalCanonicalReplayLifecycle()
    try {
      await installLocalCanonicalReplayBoundary(context, { baseURL, travelId: FALLBACK_TRAVEL_ID })
      await provide()
    } finally {
      await finishLocalCanonicalReplayBoundaries(owner)
    }
  }, { auto: true }],
})

export { expect }
