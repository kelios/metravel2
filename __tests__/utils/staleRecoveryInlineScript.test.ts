import { RECOVERY_SESSION_KEYS } from '@/utils/recovery/sessionRecovery'
import { STALE_ERROR_PATTERN_SOURCE } from '@/utils/recovery/staleErrorPattern'
import { getStaleRecoveryInlineScript } from '@/utils/recovery/staleRecoveryInlineScript'

describe('staleRecoveryInlineScript', () => {
  it('contains shared recovery keys and stale pattern source', () => {
    const script = getStaleRecoveryInlineScript()

    expect(script).toContain(RECOVERY_SESSION_KEYS.chunkReloadTs)
    expect(script).toContain(RECOVERY_SESSION_KEYS.chunkReloadCount)
    expect(script).toContain(STALE_ERROR_PATTERN_SOURCE)
  })

  it('listens to pre-react runtime errors and rejections', () => {
    const script = getStaleRecoveryInlineScript()

    expect(script).toContain("window.addEventListener('error'")
    expect(script).toContain("window.addEventListener('unhandledrejection'")
  })
})
