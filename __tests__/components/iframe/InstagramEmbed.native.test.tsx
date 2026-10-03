import React from 'react'
import { readFileSync } from 'fs'
import path from 'path'
import renderer, { act } from 'react-test-renderer'

const mockOpenExternalUrl = jest.fn()

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    text: '#111111',
    textMuted: '#666666',
    primary: '#0a84ff',
    primaryText: '#0a6b5f',
    surface: '#ffffff',
    surfaceMuted: '#f7f7f7',
    borderLight: '#e5e7eb',
  }),
}))

import InstagramEmbed from '@/components/iframe/InstagramEmbed.native'

const POST_EMBED = 'https://www.instagram.com/p/CRTm_GpnjVR/embed/?omitscript=true&hidecaption=1'

const renderEmbed = (url: string) => {
  let tree: renderer.ReactTestRenderer
  act(() => {
    tree = renderer.create(<InstagramEmbed url={url} />)
  })
  return tree!
}

const linkCard = (tree: renderer.ReactTestRenderer) =>
  tree.root.findByProps({ testID: 'travel-instagram-link-card' })

// #2135: страница instagram.com/…/embed/ несёт cookie-согласие Meta и её
// логирование — на native пост открывается карточкой-ссылкой, без WebView.
describe('InstagramEmbed (native) — карточка-ссылка без стороннего WebView', () => {
  beforeEach(() => {
    mockOpenExternalUrl.mockClear()
  })

  it('не импортирует react-native-webview: код Meta внутри приложения не грузится', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../../components/iframe/InstagramEmbed.native.tsx'),
      'utf8',
    )

    expect(source).not.toMatch(/from ['"]react-native-webview['"]/)
    expect(source).not.toMatch(/require\(['"]react-native-webview['"]\)/)
  })

  it('пост из embed-URL открывается в Instagram/браузере по каноническому адресу', () => {
    const tree = renderEmbed(POST_EMBED)
    const card = linkCard(tree)

    expect(card.props.accessibilityRole).toBe('link')
    expect(tree.root.findAllByProps({ testID: 'travel-instagram-webview' })).toHaveLength(0)

    act(() => {
      card.props.onPress()
    })

    expect(mockOpenExternalUrl).toHaveBeenCalledTimes(1)
    expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://www.instagram.com/p/CRTm_GpnjVR/')
  })

  it('канонический URL поста даёт ту же карточку и тот же адрес', () => {
    const tree = renderEmbed('https://www.instagram.com/p/CRTm_GpnjVR/')

    act(() => {
      linkCard(tree).props.onPress()
    })

    expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://www.instagram.com/p/CRTm_GpnjVR/')
  })

  it('stories тоже карточка-ссылка', () => {
    const tree = renderEmbed('https://www.instagram.com/stories/metravelby/123456/')

    act(() => {
      linkCard(tree).props.onPress()
    })

    expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://www.instagram.com/stories/metravelby/123456/')
  })

  it('невалидный Instagram URL не рендерит ничего', () => {
    const tree = renderEmbed('https://www.instagram.com/')

    expect(tree.toJSON()).toBeNull()
  })
})
