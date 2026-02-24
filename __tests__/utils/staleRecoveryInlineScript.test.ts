import { RECOVERY_SESSION_KEYS } from '@/utils/recovery/sessionRecovery'
import { STALE_ERROR_PATTERN_SOURCE } from '@/utils/recovery/staleErrorPattern'
import { getStaleRecoveryInlineScript } from '@/utils/recovery/staleRecoveryInlineScript'

describe('staleRecoveryInlineScript', () => {
  it('contains shared recovery keys and stale pattern source', () => {
    const script = getStaleRecoveryInlineScript()

    expect(script).toContain(RECOVERY_SESSION_KEYS.chunkReloadTs)
    expect(script).toContain(RECOVERY_SESSION_KEYS.chunkReloadCount)
    // Pattern source is JSON-stringified in the script, so check for key patterns
    expect(script).toContain('asyncrequireerror')
    expect(script).toContain('loading chunk')
  })

  it('listens to pre-react runtime errors and rejections', () => {
    const script = getStaleRecoveryInlineScript()

    expect(script).toContain("window.addEventListener('error'")
    expect(script).toContain("window.addEventListener('unhandledrejection'")
  })

  it('contains hard reload key for tracking recovery state', () => {
    const script = getStaleRecoveryInlineScript()

    expect(script).toContain('__metravel_hard_reload_pending')
  })

  it('uses fetch with cache reload to bypass disk cache', () => {
    const script = getStaleRecoveryInlineScript()

    // Should use fetch with cache: 'reload' to bypass browser disk cache
    expect(script).toContain("cache: 'reload'")
    expect(script).toContain('hardReloadWithCacheBust')
  })

  it('detects script load errors for chunk 404s', () => {
    const script = getStaleRecoveryInlineScript()

    // Should check for script load errors (chunk 404s)
    expect(script).toContain('isScriptLoadError')
    expect(script).toContain('/_expo/static/js/')
  })

  it('stale pattern includes React #130 with args[]=undefined', () => {
    // Verify the pattern source includes React #130 detection
    expect(STALE_ERROR_PATTERN_SOURCE).toContain('react error #130')
    expect(STALE_ERROR_PATTERN_SOURCE).toContain('args')

    // Test the actual regex
    const staleRegex = new RegExp(STALE_ERROR_PATTERN_SOURCE, 'i')
    expect(staleRegex.test('Minified React error #130; visit https://react.dev/errors/130?args[]=undefined&args[]=')).toBe(true)
  })

  it('stale pattern includes AsyncRequireError', () => {
    const staleRegex = new RegExp(STALE_ERROR_PATTERN_SOURCE, 'i')
    expect(staleRegex.test('AsyncRequireError: Loading module failed')).toBe(true)
  })
})
