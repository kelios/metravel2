const {
  isExpectedProxyTransportFailure,
} = require('../../scripts/serve-web-build')

describe('E2E web proxy transport logging', () => {
  it.each([
    'EAI_AGAIN',
    'ECONNREFUSED',
    'EHOSTDOWN',
    'ENETDOWN',
    'ENETUNREACH',
    'ETIMEDOUT',
  ])('treats an unavailable guest-E2E upstream as expected (%s)', (code) => {
    expect(isExpectedProxyTransportFailure({ code, message: 'upstream unavailable' })).toBe(true)
  })

  it('treats proxy timeouts and socket shutdowns as expected transport failures', () => {
    expect(
      isExpectedProxyTransportFailure(new Error('Proxy timeout after 60000ms')),
    ).toBe(true)
    expect(isExpectedProxyTransportFailure(new Error('socket hang up'))).toBe(true)
  })

  it('keeps unexpected proxy failures visible', () => {
    expect(
      isExpectedProxyTransportFailure({ code: 'EPROTO', message: 'TLS protocol failure' }),
    ).toBe(false)
  })
})
