/**
 * @jest-environment jsdom
 */
import {
  buildUnknownCityNotFoundHydrationScript,
  isUnknownCityDocumentPath,
  takeUnknownCityHydrationPath,
  UNKNOWN_CITY_HYDRATION_BOOT_KEY,
  UNKNOWN_CITY_HYDRATION_PATH,
  UNKNOWN_CITY_HYDRATION_STASH,
  UNKNOWN_CITY_NOT_FOUND_ELEMENT_ID,
} from '@/utils/unknownCityNotFoundHydration'

const runScript = () => {
  // Скрипт вшивается в HTML как есть и читает глобальные window/document.
  const runner = new Function(buildUnknownCityNotFoundHydrationScript())
  runner()
}

describe('unknown city not-found hydration (#2107)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    sessionStorage.clear()
    delete (window as unknown as Record<string, unknown>)[UNKNOWN_CITY_HYDRATION_STASH]
    window.history.replaceState(null, '', '/')
  })

  it('treats only a single /quests/<alias> segment as the not-found shell case', () => {
    expect(isUnknownCityDocumentPath('/quests/no-such-city-x')).toBe(true)
    expect(isUnknownCityDocumentPath('/quests/minsk/')).toBe(true)
    expect(isUnknownCityDocumentPath('/quests')).toBe(false)
    expect(isUnknownCityDocumentPath('/quests/country/belarus')).toBe(false)
    expect(isUnknownCityDocumentPath('/quests/country/no-such-country-x')).toBe(false)
  })

  it('does not rewrite a cold document, but remembers the tab for the next load', () => {
    document.body.innerHTML = `<div id="${UNKNOWN_CITY_NOT_FOUND_ELEMENT_ID}"></div>`
    window.history.replaceState(null, '', '/quests/no-such-city-x')

    runScript()

    expect(window.location.pathname).toBe('/quests/no-such-city-x')
    expect(sessionStorage.getItem(UNKNOWN_CITY_HYDRATION_BOOT_KEY)).toBe('1')
    expect((window as unknown as Record<string, unknown>)[UNKNOWN_CITY_HYDRATION_STASH]).toBeUndefined()
  })

  it('rewrites a warm unknown-city document onto the prebuilt not-found route before the bundle', () => {
    sessionStorage.setItem(UNKNOWN_CITY_HYDRATION_BOOT_KEY, '1')
    document.body.innerHTML = `<div id="${UNKNOWN_CITY_NOT_FOUND_ELEMENT_ID}"></div>`
    window.history.replaceState(null, '', '/quests/no-such-city-x?from=warm#top')

    runScript()

    expect(window.location.pathname).toBe(UNKNOWN_CITY_HYDRATION_PATH)
    expect((window as unknown as Record<string, unknown>)[UNKNOWN_CITY_HYDRATION_STASH]).toBe(
      '/quests/no-such-city-x?from=warm#top',
    )
  })

  it('leaves a real city document and other routes on their own URL', () => {
    sessionStorage.setItem(UNKNOWN_CITY_HYDRATION_BOOT_KEY, '1')
    window.history.replaceState(null, '', '/quests/minsk')
    runScript()
    expect(window.location.pathname).toBe('/quests/minsk')

    document.body.innerHTML = `<div id="${UNKNOWN_CITY_NOT_FOUND_ELEMENT_ID}"></div>`
    window.history.replaceState(null, '', '/quests/country/no-such-country-x')
    runScript()
    expect(window.location.pathname).toBe('/quests/country/no-such-country-x')
    expect((window as unknown as Record<string, unknown>)[UNKNOWN_CITY_HYDRATION_STASH]).toBeUndefined()
  })

  it('returns the stashed city URL once and ignores anything else', () => {
    ;(window as unknown as Record<string, unknown>)[UNKNOWN_CITY_HYDRATION_STASH] = '/quests/no-such-city-x'
    expect(takeUnknownCityHydrationPath(window as unknown as Record<string, unknown>)).toBe(
      '/quests/no-such-city-x',
    )
    expect(takeUnknownCityHydrationPath(window as unknown as Record<string, unknown>)).toBeNull()

    ;(window as unknown as Record<string, unknown>)[UNKNOWN_CITY_HYDRATION_STASH] = '/quests/country/belarus'
    expect(takeUnknownCityHydrationPath(window as unknown as Record<string, unknown>)).toBeNull()
    ;(window as unknown as Record<string, unknown>)[UNKNOWN_CITY_HYDRATION_STASH] = 'https://evil.example/quests/minsk'
    expect(takeUnknownCityHydrationPath(window as unknown as Record<string, unknown>)).toBeNull()
  })
})
