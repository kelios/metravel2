import React from 'react'
import { readFileSync } from 'fs'
import path from 'path'
import { fireEvent, render } from '@testing-library/react-native'

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

const renderEmbed = (url: string) => render(<InstagramEmbed url={url} />)

// testID несут и общая карточка `ExternalContentLinkCard`, и её Pressable —
// ссылка та, у которой роль `link`.
const linkCard = (screen: Awaited<ReturnType<typeof renderEmbed>>) => screen.getByRole('link')

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

  it('пост из embed-URL открывается в Instagram/браузере по каноническому адресу', async () => {
    const tree = await renderEmbed(POST_EMBED)
    const card = linkCard(tree)

    expect(card.props.accessibilityRole).toBe('link')
    expect(tree.queryByTestId('travel-instagram-webview')).toBeNull()

    await fireEvent.press(card)

    expect(mockOpenExternalUrl).toHaveBeenCalledTimes(1)
    expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://www.instagram.com/p/CRTm_GpnjVR/')
  })

  it('канонический URL поста даёт ту же карточку и тот же адрес', async () => {
    const tree = await renderEmbed('https://www.instagram.com/p/CRTm_GpnjVR/')

    await fireEvent.press(linkCard(tree))

    expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://www.instagram.com/p/CRTm_GpnjVR/')
  })

  it('stories тоже карточка-ссылка', async () => {
    const tree = await renderEmbed('https://www.instagram.com/stories/metravelby/123456/')

    await fireEvent.press(linkCard(tree))

    expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://www.instagram.com/stories/metravelby/123456/')
  })

  it('невалидный Instagram URL не рендерит ничего', async () => {
    const tree = await renderEmbed('https://www.instagram.com/')

    expect(tree.toJSON()).toBeNull()
  })
})
