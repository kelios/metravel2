import {
  buildExplicitLoginHref,
  hasSignedInBefore,
  markSignedInBefore,
  sanitizeAuthSubject,
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
    expect(buildLoginHref({ redirect: '//attacker.example', intent: 'profile' })).toBe(
      '/login?redirect=%2F&intent=profile',
    )
    expect(buildRegistrationHref({ redirect: '/%252f%252fattacker.example' })).toBe(
      '/registration?redirect=%2F',
    )
    expect(buildRegistrationHref({ redirect: '/article/test?draft=1#comments' })).toBe(
      '/registration?redirect=%2Farticle%2Ftest%3Fdraft%3D1%23comments',
    )
  })
})

describe('authNavigation intent entry (#2898)', () => {
  const { Platform } = require('react-native')
  const originalOS = Platform.OS

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'web' })
    window.localStorage.clear()
  })
  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOS })
  })

  it('sends a guest action to registration on a device that never signed in, with the item title', () => {
    expect(buildLoginHref({ redirect: '/travels/grodno', intent: 'calendar', subject: '  «Гродно\nза 1 день»  ' })).toBe(
      '/registration?redirect=%2Ftravels%2Fgrodno&intent=calendar&subject=%D0%93%D1%80%D0%BE%D0%B4%D0%BD%D0%BE+%D0%B7%D0%B0+1+%D0%B4%D0%B5%D0%BD%D1%8C',
    )
  })

  it('keeps sign-in for returning devices and for page-level intents', () => {
    expect(buildLoginHref({ redirect: '/profile', intent: 'profile' })).toBe('/login?redirect=%2Fprofile&intent=profile')
    markSignedInBefore()
    expect(hasSignedInBefore()).toBe(true)
    expect(buildLoginHref({ redirect: '/travels/grodno', intent: 'calendar' })).toBe(
      '/login?redirect=%2Ftravels%2Fgrodno&intent=calendar',
    )
  })

  it('never bounces the explicit «Sign in» link back to registration', () => {
    expect(buildExplicitLoginHref({ redirect: '/travels/grodno', intent: 'favorite' })).toBe(
      '/login?redirect=%2Ftravels%2Fgrodno&intent=favorite',
    )
  })

  it('sanitizes the subject: no quotes or line breaks, at most 80 characters', () => {
    expect(sanitizeAuthSubject(['  "Минск"  ', 'x'])).toBe('Минск')
    expect(sanitizeAuthSubject('   ')).toBeUndefined()
    expect(sanitizeAuthSubject(42)).toBeUndefined()
    const long = sanitizeAuthSubject('а'.repeat(200))
    expect(long).toHaveLength(80)
    expect(long?.endsWith('…')).toBe(true)
  })
})
