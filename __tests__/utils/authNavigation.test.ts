import {
  buildLoginHref,
  buildRegistrationHref,
  normalizeInternalAuthRedirect,
  resolvePostAuthPath,
} from '@/utils/authNavigation'

describe('authNavigation redirect security', () => {
  it.each([
    '//attacker.example/path',
    '/%2f%2fattacker.example/path',
    '/%252f%252fattacker.example/path',
    '/%25252f%25252fattacker.example/path',
    '\\\\attacker.example\\path',
    '/%5c%5cattacker.example/path',
    '/%255c%255cattacker.example/path',
    'https://attacker.example/path',
    '/https://attacker.example/path',
    '/h%74tps%3a%2f%2fattacker.example/path',
    '/javascript:alert(1)',
    '/jav%61script%3aalert(1)',
    '/data:text/html,test',
    ' /profile',
    '/profile ',
    '/profile\nnext',
    '/profile%0anext',
    '/profile%250anext',
    '/profile%zz',
  ])('rejects unsafe redirect %p', (redirect) => {
    expect(normalizeInternalAuthRedirect(redirect)).toBe('/')
  })

  it('preserves valid internal paths with query and fragment data', () => {
    expect(normalizeInternalAuthRedirect('/travel/42?tab=map&q=hello%20world#point-1')).toBe(
      '/travel/42?tab=map&q=hello%20world#point-1',
    )
    expect(normalizeInternalAuthRedirect('/search?q=100%25')).toBe('/search?q=100%25')
  })

  it('uses only a validated fallback', () => {
    expect(normalizeInternalAuthRedirect('//attacker.example', '/profile')).toBe('/profile')
    expect(normalizeInternalAuthRedirect('//attacker.example', '//fallback.example')).toBe('/')
    expect(resolvePostAuthPath({ fallbackRedirect: '//fallback.example' })).toBe('/')
  })

  it('resolves the shared login and registration post-auth destination safely', () => {
    expect(resolvePostAuthPath({ redirect: '/favorites?tab=travels#saved' })).toBe(
      '/favorites?tab=travels#saved',
    )
    expect(resolvePostAuthPath({ redirect: '//attacker.example' })).toBe('/')
    expect(resolvePostAuthPath({ redirect: '/%252f%252fattacker.example' })).toBe('/')
    expect(resolvePostAuthPath({ redirect: '//attacker.example', intent: 'create-book' })).toBe(
      '/travel/new',
    )
    expect(resolvePostAuthPath({ redirect: '//attacker.example', intent: 'build-pdf' })).toBe('/export')
  })

  it('sanitizes redirects embedded in login and registration hrefs', () => {
    expect(buildLoginHref({ redirect: '//attacker.example', intent: 'favorite' })).toBe(
      '/login?redirect=%2F&intent=favorite',
    )
    expect(buildRegistrationHref({ redirect: '/%252f%252fattacker.example' })).toBe(
      '/registration?redirect=%2F',
    )
    expect(buildRegistrationHref({ redirect: '/article/test?draft=1#comments' })).toBe(
      '/registration?redirect=%2Farticle%2Ftest%3Fdraft%3D1%23comments',
    )
  })
})
