// Keep this suite small and product-facing. Quality-pipeline/governance script tests
// belong to test:governance or the full Jest run, not to the critical user-flow smoke.
const SMOKE_CRITICAL_TESTS = [
  '__tests__/app/export.test.tsx',
  '__tests__/app/subscriptions.test.tsx',
  '__tests__/components/profile.test.tsx',
  '__tests__/api/travels.test.ts',
  '__tests__/stores/authStore.test.ts',
  '__tests__/components/MapPage/useRouting.safety.test.ts',
  '__tests__/utils/questAdapters.test.ts',
  '__tests__/utils/placesCatalog.test.ts',
  '__tests__/utils/filterQuery.test.ts',
  '__tests__/hooks/useTheme.test.tsx',
]

module.exports = {
  SMOKE_CRITICAL_TESTS,
}
