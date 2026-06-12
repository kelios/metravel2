import { Platform } from 'react-native'

import { resolveInternalHref, handleRichTextLinkPress } from '@/utils/internalLinks'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('@/utils/externalLinks', () => ({ openExternalUrl: jest.fn() }))

const { router } = require('expo-router')
const { openExternalUrl } = require('@/utils/externalLinks')

describe('resolveInternalHref', () => {
  it('относительный путь на свой сайт → внутренний путь', () => {
    expect(resolveInternalHref('/travels/123')).toBe('/travels/123')
    expect(resolveInternalHref('/article/some-slug?x=1#h')).toBe('/article/some-slug?x=1#h')
  })

  it('абсолютная ссылка на metravel.by → внутренний путь', () => {
    expect(resolveInternalHref('https://metravel.by/article/slug')).toBe('/article/slug')
    expect(resolveInternalHref('https://www.metravel.by/travels/7')).toBe('/travels/7')
    expect(resolveInternalHref('http://metravel.by/quests/minsk')).toBe('/quests/minsk')
  })

  it('абсолютная ссылка на metravel.by без пути → "/"', () => {
    expect(resolveInternalHref('https://metravel.by')).toBe('/')
  })

  it('внешние ссылки → null', () => {
    expect(resolveInternalHref('https://google.com/x')).toBeNull()
    expect(resolveInternalHref('https://evil-metravel.by/x')).toBeNull()
  })

  it('спец-схемы и якоря → null', () => {
    expect(resolveInternalHref('mailto:a@b.by')).toBeNull()
    expect(resolveInternalHref('tel:+375')).toBeNull()
    expect(resolveInternalHref('#section')).toBeNull()
    expect(resolveInternalHref('//evil.com/path')).toBeNull()
    expect(resolveInternalHref('')).toBeNull()
    expect(resolveInternalHref(null)).toBeNull()
  })
})

describe('handleRichTextLinkPress (native)', () => {
  const originalOS = Platform.OS
  beforeEach(() => jest.clearAllMocks())
  afterEach(() => {
    ;(Platform as { OS: string }).OS = originalOS
  })

  it('внутренняя ссылка → router.push, без внешнего браузера', () => {
    ;(Platform as { OS: string }).OS = 'android'
    handleRichTextLinkPress('https://metravel.by/travels/42')
    expect(router.push).toHaveBeenCalledWith('/travels/42')
    expect(openExternalUrl).not.toHaveBeenCalled()
  })

  it('внешняя ссылка → openExternalUrl, без router.push', () => {
    ;(Platform as { OS: string }).OS = 'android'
    handleRichTextLinkPress('https://example.com/page')
    expect(openExternalUrl).toHaveBeenCalledTimes(1)
    expect(router.push).not.toHaveBeenCalled()
  })

  it('пустой href — ничего не делает', () => {
    handleRichTextLinkPress(undefined)
    expect(router.push).not.toHaveBeenCalled()
    expect(openExternalUrl).not.toHaveBeenCalled()
  })
})
