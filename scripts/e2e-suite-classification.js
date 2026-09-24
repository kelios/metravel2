const LIVE_CONTRACT_SUITE = 'live-contract'
const PRODUCTION_SMOKE_SUITE = 'production-smoke'

// These specs create, update, upload, reset, or delete real backend records.
// They are intentionally absent from the default deterministic regression suite.
const LIVE_CONTRACT_SPECS = [
  'auth-logout.spec.ts',
  'draft-recovery.spec.ts',
  'image-upload.spec.ts',
  'metravel-edit-delete.spec.ts',
  'mobile-screen-budget-trip-plan.live.spec.ts',
  'planned-trip-overnight-booking.spec.ts',
  'public-trips.spec.ts',
  'travel-content-save-delta.spec.ts',
  'travel-crud.spec.ts',
  'travel-draft-owner-preview.spec.ts',
  'travel-full-flow.spec.ts',
  'travel-persistence.spec.ts',
  'travel-wizard-point-photo-isolation.live.spec.ts',
  'travel-wizard-draft-f09-verify.spec.ts',
]

const PRODUCTION_SMOKE_SPECS = [
  'google-signin.spec.ts',
  // #2094: thin companion over the shared e2e/helpers/mobileScreenBudget.ts —
  // only the public screens (`SCREENS[].isPublic`). The full 13-screen
  // `mobile-screen-budget.spec.ts` (public + authenticated) is intentionally
  // NOT listed here: this array is also the default suite's `testIgnore`
  // list below, so adding it here would drop it out of the default local
  // regression run entirely.
  'mobile-screen-budget-production-smoke.spec.ts',
  'prod-media-smoke.spec.ts',
  'public-regressions.spec.ts',
]

const getE2ESuiteSelection = (suite) => {
  if (suite === LIVE_CONTRACT_SUITE) {
    return { testMatch: LIVE_CONTRACT_SPECS }
  }
  if (suite === PRODUCTION_SMOKE_SUITE) {
    return { testMatch: PRODUCTION_SMOKE_SPECS }
  }
  return {
    testIgnore: [...LIVE_CONTRACT_SPECS, ...PRODUCTION_SMOKE_SPECS],
  }
}

module.exports = {
  LIVE_CONTRACT_SUITE,
  LIVE_CONTRACT_SPECS,
  PRODUCTION_SMOKE_SUITE,
  PRODUCTION_SMOKE_SPECS,
  getE2ESuiteSelection,
}
