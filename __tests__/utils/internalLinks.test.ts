import { Platform } from 'react-native'

import { resolveInternalHref, handleRichTextLinkPress } from '@/utils/internalLinks'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('@/utils/seo', () => ({ getSiteBaseUrl: () => 'https://metravel.by' }))

const { router } = require('expo-router')
const { Linking } = require('react-native')

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

  it('about:///path (нормализация относительных href в react-native-render-html) → внутренний путь', () => {
    expect(resolveInternalHref('about:///travels/oriavskii-zamok')).toBe('/travels/oriavskii-zamok')
    expect(resolveInternalHref('about:///article/slug?x=1')).toBe('/article/slug?x=1')
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

// #2144: настоящий `openExternalUrl` — единая точка решения на native; моки
// только на границе (router, системный Linking).
describe.each(['ios', 'android'])('handleRichTextLinkPress (%s)', (os) => {
  const originalOS = Platform.OS
  let openURL: jest.SpyInstance
  beforeEach(() => {
    jest.clearAllMocks()
    ;(Platform as { OS: string }).OS = os
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
  })
  afterEach(() => {
    ;(Platform as { OS: string }).OS = originalOS
    openURL.mockRestore()
  })
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

  it.each([
    ['https://metravel.by/media/x.jpg', 'https://metravel.by/media/x.jpg'],
    ['/media/x.jpg', 'https://metravel.by/media/x.jpg'],
    ['about:///media/x.jpg', 'https://metravel.by/media/x.jpg'],
    ['https://metravel.by/board', 'https://metravel.by/board'],
    ['https://metravel.by/api/travels/1/', 'https://metravel.by/api/travels/1/'],
    ['https://example.com/x', 'https://example.com/x'],
    ['https://metravel.by.evil.com/x', 'https://metravel.by.evil.com/x'],
  ])('%s → системный браузер, router.push не вызван', async (href, opened) => {
    handleRichTextLinkPress(href)
    await flush()
    expect(router.push).not.toHaveBeenCalled()
    expect(openURL).toHaveBeenCalledWith(opened)
  })

  it.each([
    ['https://metravel.by/travels/slug#comments', '/travels/slug'],
    ['https://metravel.by/travels/42', '/travels/42'],
    ['https://www.metravel.by/quests/city/q', '/quests/city/q'],
    ['/article/slug?x=1#h', '/article/slug?x=1'],
    ['about:///travels/oriavskii-zamok', '/travels/oriavskii-zamok'],
  ])('%s → экран приложения %s без якоря, без браузера', async (href, route) => {
    handleRichTextLinkPress(href)
    await flush()
    expect(router.push).toHaveBeenCalledWith(route)
    expect(openURL).not.toHaveBeenCalled()
  })

  it.each(['#section', 'mailto:a@b.by', 'tel:+375', '', undefined])('%s → ничего не открывает', async (href) => {
    handleRichTextLinkPress(href as string | undefined)
    await flush()
    expect(router.push).not.toHaveBeenCalled()
    expect(openURL).not.toHaveBeenCalled()
  })
})
