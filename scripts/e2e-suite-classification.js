const LIVE_CONTRACT_SUITE = 'live-contract'
const PRODUCTION_SMOKE_SUITE = 'production-smoke'

// These specs create, update, upload, reset, or delete real backend records.
// They are intentionally absent from the default deterministic regression suite.
const LIVE_CONTRACT_SPECS = [
  'auth-logout.spec.ts',
  'draft-recovery.spec.ts',
  'image-upload.spec.ts',
  'metravel-edit-delete.spec.ts',
  'public-trips.spec.ts',
  'travel-crud.spec.ts',
  'travel-draft-owner-preview.spec.ts',
  'travel-full-flow.spec.ts',
  'travel-persistence.spec.ts',
  'travel-wizard-draft-f09-verify.spec.ts',
]

const PRODUCTION_SMOKE_SPECS = [
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
