import { hasFreshHtmlBundleMismatch } from '@/utils/recovery/bundleScriptMismatch'

const TEST_ATTR = 'data-test-bundle-script-mismatch'

const addCurrentScripts = (scripts: string[]) => {
  scripts.forEach((src) => {
    const el = document.createElement('script')
    el.setAttribute('src', src)
    el.setAttribute(TEST_ATTR, '1')
    document.head.appendChild(el)
  })
}

const cleanupCurrentScripts = () => {
  document
    .querySelectorAll(`script[${TEST_ATTR}="1"]`)
    .forEach((el) => el.parentNode?.removeChild(el))
}

describe('bundleScriptMismatch', () => {
  let originalFetch: any

  beforeEach(() => {
    originalFetch = (global as any).fetch
    cleanupCurrentScripts()
  })

  afterEach(() => {
    ;(global as any).fetch = originalFetch
    cleanupCurrentScripts()
  })

  it('returns false when current page has no core bundle scripts', async () => {
    ;(global as any).fetch = jest.fn()

    await expect(hasFreshHtmlBundleMismatch('https://metravel.by/map')).resolves.toBe(false)
    expect((global as any).fetch).not.toHaveBeenCalled()
  })

  it('returns true when fresh html core scripts differ from current scripts', async () => {
    addCurrentScripts(['/_expo/static/js/web/entry-old.js'])
    ;(global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '<html><head><script src="/_expo/static/js/web/entry-new.js"></script></head></html>',
    })

    await expect(hasFreshHtmlBundleMismatch('https://metravel.by/map')).resolves.toBe(true)
  })

  it('returns false when fresh html core scripts match current scripts', async () => {
    addCurrentScripts([
      '/_expo/static/js/web/__common-same.js',
      '/_expo/static/js/web/entry-same.js',
    ])
    ;(global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        '<html><head><script src="/_expo/static/js/web/entry-same.js"></script><script src="/_expo/static/js/web/__common-same.js"></script></head></html>',
    })

    await expect(hasFreshHtmlBundleMismatch('https://metravel.by/map')).resolves.toBe(false)
  })

  it('returns false when fresh html request is not ok', async () => {
    addCurrentScripts(['/_expo/static/js/web/entry-old.js'])
    ;(global as any).fetch = jest.fn().mockResolvedValue({ ok: false })

    await expect(hasFreshHtmlBundleMismatch('https://metravel.by/map')).resolves.toBe(false)
  })
})
