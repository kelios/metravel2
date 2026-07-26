import React from 'react'
import renderer, { act } from 'react-test-renderer'

import { __resetInstagramEmbedSlots, getInstagramEmbedSlotLimit } from '@/components/iframe/instagramEmbedSlots'

const mockOpenExternalUrl = jest.fn()

jest.mock('react-native-webview', () => {
  const { View } = require('react-native')
  return { WebView: (props: any) => <View {...props} /> }
})

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

const POST = 'https://www.instagram.com/p/CRTm_GpnjVR/embed/?omitscript=true&hidecaption=1'

const renderEmbeds = (urls: string[]) => {
  let tree: renderer.ReactTestRenderer
  act(() => {
    tree = renderer.create(
      <>
        {urls.map((url) => (
          <InstagramEmbed key={url} url={url} />
        ))}
      </>
    )
  })
  return tree!
}

const webViews = (tree: renderer.ReactTestRenderer) =>
  tree.root.findAllByProps({ testID: 'travel-instagram-webview' }, { deep: false })

const embedFrame = (tree: renderer.ReactTestRenderer) =>
  tree.root.find(
    (node) =>
      Array.isArray(node.props.style) &&
      node.props.style.some((style: unknown) => Boolean(style) && typeof (style as { height?: unknown }).height === 'number')
  )

describe('InstagramEmbed (native)', () => {
  beforeEach(() => {
    __resetInstagramEmbedSlots()
    mockOpenExternalUrl.mockClear()
  })

  it('монтирует WebView с тем же embed-URL, что и web-facade', () => {
    const tree = renderEmbeds([POST])
    const views = webViews(tree)

    expect(views).toHaveLength(1)
    expect(views[0].props.source).toEqual({
      uri: 'https://www.instagram.com/p/CRTm_GpnjVR/embed/?omitscript=true&hidecaption=1',
    })
    // Скроллит статья, а не пост — иначе жест тонет в WebView.
    expect(views[0].props.scrollEnabled).toBe(false)
  })

  it('принимает и канонический URL поста, и уже готовый embed-URL', () => {
    const tree = renderEmbeds(['https://www.instagram.com/p/CRTm_GpnjVR/'])

    expect(webViews(tree)[0].props.source).toEqual({
      uri: 'https://www.instagram.com/p/CRTm_GpnjVR/embed/?omitscript=true&hidecaption=1',
    })
  })

  it('держит живыми не больше лимита WebView — статья из 40 постов не поднимает их все', () => {
    const cap = getInstagramEmbedSlotLimit()
    const urls = Array.from({ length: cap + 3 }, (_, i) => `https://www.instagram.com/p/CODE${i}/`)
    const tree = renderEmbeds(urls)

    expect(webViews(tree)).toHaveLength(cap)
  })

  it('освобождает слот при размонтировании — следующий пост получает WebView', () => {
    const cap = getInstagramEmbedSlotLimit()
    const urls = Array.from({ length: cap + 1 }, (_, i) => `https://www.instagram.com/p/CODE${i}/`)
    const tree = renderEmbeds(urls)
    expect(webViews(tree)).toHaveLength(cap)

    act(() => {
      tree.update(
        <>
          {urls.slice(1).map((url) => (
            <InstagramEmbed key={url} url={url} />
          ))}
        </>
      )
    })

    expect(webViews(tree)).toHaveLength(cap)
  })

  it('stories отдаёт карточкой-ссылкой: у них нет embed-endpoint', () => {
    const tree = renderEmbeds(['https://www.instagram.com/stories/metravelby/123456/'])

    expect(webViews(tree)).toHaveLength(0)
    act(() => {
      tree.root.findByProps({ accessibilityRole: 'link' }).props.onPress()
    })
    expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://www.instagram.com/stories/metravelby/123456/')
  })

  it('переход за пределы эмбеда уводит во внешний браузер, а не в WebView статьи', () => {
    const tree = renderEmbeds([POST])
    const props = webViews(tree)[0].props

    expect(props.onShouldStartLoadWithRequest({ url: POST })).toBe(true)

    // До первой отрисовки чужой переход только блокируем: авто-редирект на
    // логин-стену не должен выкидывать читателя из статьи.
    expect(props.onShouldStartLoadWithRequest({ url: 'https://www.instagram.com/accounts/login/' })).toBe(false)
    expect(mockOpenExternalUrl).not.toHaveBeenCalled()

    act(() => {
      props.onLoadEnd()
    })
    expect(props.onShouldStartLoadWithRequest({ url: 'https://www.instagram.com/p/OTHER/' })).toBe(false)
    expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://www.instagram.com/p/OTHER/')
  })

  it('ошибка загрузки эмбеда откатывает пост в карточку-ссылку', () => {
    const tree = renderEmbeds([POST])

    act(() => {
      webViews(tree)[0].props.onError()
    })

    expect(webViews(tree)).toHaveLength(0)
    expect(tree.root.findAllByProps({ accessibilityRole: 'link' }, { deep: false })).not.toHaveLength(0)
  })

  it('переводит реальные CSS-метрики Instagram в RN dp и игнорирует раздутый viewport', () => {
    const tree = renderEmbeds([POST])
    const props = webViews(tree)[0].props

    act(() => {
      props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: 'ig-height',
            height: 1203,
            contentHeight: 1203,
            bodyHeight: 1190,
            frameHeight: 980,
            docHeight: 2992,
            viewportHeight: 2992,
            viewportWidth: 980,
            displayWidth: 390,
          }),
        },
      })
    })

    expect(embedFrame(tree).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ height: 479 })])
    )
  })

  it('падает обратно на body/doc только если frame ещё не измерен', () => {
    const tree = renderEmbeds([POST])
    const props = webViews(tree)[0].props

    act(() => {
      props.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: 'ig-height',
            bodyHeight: 620,
            docHeight: 1400,
            viewportHeight: 1400,
          }),
        },
      })
    })

    expect(embedFrame(tree).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ height: 620 })])
    )
  })

  it('невалидный Instagram URL не рендерит ничего', () => {
    const tree = renderEmbeds(['https://www.instagram.com/'])

    expect(tree.toJSON()).toBeNull()
  })
})
