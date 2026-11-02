import { isAppleSafariUserAgent } from '@/hooks/usePreferAppleSignIn'

describe('isAppleSafariUserAgent (#2898)', () => {
  it('prefers Apple only in real Safari', () => {
    expect(isAppleSafariUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe(true)
    expect(isAppleSafariUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15')).toBe(true)
    expect(isAppleSafariUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1')).toBe(false)
    expect(isAppleSafariUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')).toBe(false)
    expect(isAppleSafariUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0')).toBe(false)
  })
})
