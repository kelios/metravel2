import { STALE_ERROR_REGEX } from '@/utils/recovery/staleErrorPattern'

describe('staleErrorPattern', () => {
  const staleMessages = [
    'Loading module https://metravel.by/_expo/static/js/web/Home-68ad15.js failed.',
    'ChunkLoadError: Loading chunk 42 failed.',
    '(0 , r(...).getFiltersPanelStyles) is not a function',
    '(0 , r(...).useSomeHook) is not a function',
    "Class constructors cannot be invoked without 'new'",
  ]

  it.each(staleMessages)('matches stale runtime signature: %s', (message) => {
    expect(STALE_ERROR_REGEX.test(message)).toBe(true)
  })

  it('does not match generic app errors', () => {
    expect(STALE_ERROR_REGEX.test('Test error')).toBe(false)
    expect(STALE_ERROR_REGEX.test('Network timeout while loading profile')).toBe(false)
    expect(STALE_ERROR_REGEX.test('Minified React error #130; visit https://react.dev/errors/130?args[]=undefined&args[]= for the full message')).toBe(false)
    // React #130 without args[]=undefined should NOT match (could be a real runtime bug)
    expect(STALE_ERROR_REGEX.test('Minified React error #130; visit https://react.dev/errors/130?args[]=object&args[]=SomeComponent for the full message')).toBe(false)
  })
})
