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

  it('uses hard reload with cache bust param to bypass disk cache', () => {
    const script = getStaleRecoveryInlineScript()

    // Should use hardReloadWithCacheBust to force fresh load
    expect(script).toContain('hardReloadWithCacheBust')
    // Should add _cb param for cache busting
    expect(script).toContain('_cb')
  })

  it('detects script load errors for chunk 404s', () => {
    const script = getStaleRecoveryInlineScript()

    // Should check for script load errors (chunk 404s)
    expect(script).toContain('isScriptLoadError')
    expect(script).toContain('/_expo/static/js/')
  })

  it('stale pattern does NOT include React #130 (to avoid recovery loops for real bugs)', () => {
    const staleRegex = new RegExp(STALE_ERROR_PATTERN_SOURCE, 'i')
    // React #130 should NOT trigger stale recovery - it could be a real runtime bug
    expect(staleRegex.test('Minified React error #130; visit https://react.dev/errors/130?args[]=undefined&args[]=')).toBe(false)
  })

  it('stale pattern includes AsyncRequireError', () => {
    const staleRegex = new RegExp(STALE_ERROR_PATTERN_SOURCE, 'i')
    expect(staleRegex.test('AsyncRequireError: Loading module failed')).toBe(true)
  })
})
