import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'

import BottomDock from '@/components/layout/BottomDock'
import { requestOpenDockMore } from '@/components/layout/bottomDockItemDefs'
import { BOTTOM_DOCK_MORE_MENU_SECTIONS } from '@/components/layout/bottomDockModel'
import { buildBottomDockMoreSections } from '@/components/layout/bottomDockMoreSections'
import { BOTTOM_DOCK_SECTION_PATHS } from '@/constants/bottomDockRoutes'
import { DESKTOP_BAR_NAV_ITEMS, HEADER_NAV_ITEMS, SUPPLEMENTARY_NAV_ITEMS } from '@/constants/headerNavigation'

// #2779: на телефоне одно меню — лист «Ещё». Кнопка меню шапки открывает его же,
// а навигационные пункты листа выводятся из того же `HEADER_NAV_ITEMS`, что и
// строка desktop-шапки. Раньше у шапки и листа были свои списки, и наборы
// разошлись: «Попутчики» жили только в одном, «Вы смотрели» — только в другом.

const mockAuth = {
  isAuthenticated: false,
  isSuperuser: false,
  userId: null as number | null,
  username: '',
  logout: jest.fn(async () => undefined),
}
jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }))
const mockRouter = { push: jest.fn(), navigate: jest.fn() }
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/quests',
  useFocusEffect: (effect: () => undefined | (() => void)) => {
    const ReactLib = require('react')
    ReactLib.useEffect(() => effect(), [effect])
  },
}))
jest.mock('@/hooks/useDeferredUnreadCount', () => ({
  useDeferredUnreadCount: () => ({ count: 3 }),
}))
jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: jest.fn(async () => true),
  openExternalUrlInNewTab: jest.fn(),
}))

const DOCK_ROOTS = new Set<string>(BOTTOM_DOCK_SECTION_PATHS)
const sheetItems = (os: string, auth = {}) => buildBottomDockMoreSections(auth, os).flatMap((section) => section.items)

describe('одно меню телефона (#2779)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.assign(mockAuth, { isAuthenticated: false, isSuperuser: false, userId: null, username: '' })
  })

  it('каждый пункт навигации шапки, кроме корней дока, есть в листе «Ещё» — тем же адресом и подписью', () => {
    const primary = BOTTOM_DOCK_MORE_MENU_SECTIONS.find((section) => section.key === 'primary')!.items
    const expected = HEADER_NAV_ITEMS.filter((item) => !DOCK_ROOTS.has(item.path))
    expect(expected.length).toBeGreaterThan(0)
    for (const item of expected) {
      expect(primary).toContainEqual(expect.objectContaining({ route: item.path, label: item.label }))
    }
  })

  it('дополнительные пункты («Статьи», «Вы смотрели»…) — один список с меню аккаунта desktop', () => {
    const primary = BOTTOM_DOCK_MORE_MENU_SECTIONS.find((section) => section.key === 'primary')!.items
    expect(SUPPLEMENTARY_NAV_ITEMS.map((item) => item.path)).toEqual(expect.arrayContaining(['/articles', '/history']))
    for (const item of SUPPLEMENTARY_NAV_ITEMS) {
      expect(primary).toContainEqual(expect.objectContaining({ route: item.path, label: item.label }))
    }
  })

  it('«Беларусь», «Места», «Статьи» несут короткое пояснение раздела', () => {
    const primary = BOTTOM_DOCK_MORE_MENU_SECTIONS.find((section) => section.key === 'primary')!.items
    const hintOf = (route: string) => primary.find((item) => item.route === route)?.hint
    expect(hintOf('/travelsby')).toBe('Маршруты по Беларуси')
    expect(hintOf('/places')).toBe('Замки, музеи, природа на карте')
    expect(hintOf('/articles')).toBe('Советы и заметки путешественников')
  })

  it('строка desktop-шапки — подмножество того же источника', () => {
    for (const item of DESKTOP_BAR_NAV_ITEMS) expect(HEADER_NAV_ITEMS).toContain(item)
  })

  it.each(['web', 'ios', 'android'])('%s: в листе есть «Попутчики», «Travel-блогеры», «Вы смотрели», «Создать маршрут», тема и язык', (os) => {
    const labels = sheetItems(os).map((item) => item.label)
    expect(labels).toEqual(
      expect.arrayContaining([
        'Беларусь', 'Места', 'Попутчики', 'Случайный маршрут', 'Статьи', 'Travel-блогеры Беларуси',
        'Вы смотрели', 'Создать маршрут', 'Тема оформления', 'Язык интерфейса',
      ]),
    )
  })

  it.each(['web', 'ios', 'android'])('%s: в листе нет того, что уже есть в доке, и нет повторов', (os) => {
    const items = sheetItems(os, { isAuthenticated: true, userId: 7, username: 'Юля' })
    const routes = items.flatMap((item) => (typeof item.route === 'string' ? [item.route] : []))
    for (const root of DOCK_ROOTS) expect(routes).not.toContain(root)
    expect(items.map((item) => item.label)).not.toContain('Профиль')
    const keys = items.map((item) => item.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('гостю секции аккаунта нет: вход — в шапке и в «Профиле» дока', () => {
    const sections = buildBottomDockMoreSections({}, 'ios')
    expect(sections.map((section) => section.key)).toEqual(['primary', 'settings', 'secondary'])
  })

  it('вошедшему лист несёт пункты меню аккаунта: сообщения со счётчиком и выход', () => {
    const account = buildBottomDockMoreSections({ isAuthenticated: true, userId: 7, username: 'Юля', unreadCount: 3 }, 'ios')
      .find((section) => section.key === 'account')!.items
    expect(account).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'messages', label: 'Сообщения (3)', unreadCount: 3 }),
        expect.objectContaining({ key: 'my-travels', accountTarget: { kind: 'route', path: '/metravel' } }),
        expect.objectContaining({ key: 'logout', accountTarget: { kind: 'logout' } }),
      ]),
    )
    expect(account.map((item) => item.key)).not.toContain('profile')
    expect(account.map((item) => item.key)).not.toContain('travel-new')
  })

  it('кнопка меню шапки открывает тот же лист, что и пункт дока', () => {
    const { getByTestId, queryByTestId } = render(<BottomDock />)
    expect(queryByTestId('footer-more-sheet-native')).toBeNull()

    let opened = false
    act(() => {
      opened = requestOpenDockMore()
    })

    expect(opened).toBe(true)
    expect(getByTestId('footer-more-sheet-native')).toBeTruthy()
    expect(getByTestId('footer-more-item-trips')).toBeTruthy()
    expect(getByTestId('footer-more-item-history')).toBeTruthy()
    expect(queryByTestId('footer-more-item-profile')).toBeNull()
  })

  it('«Тема оформления» открывается подэкраном листа, лист не закрывается', () => {
    const { getByTestId } = render(<BottomDock />)
    fireEvent.press(getByTestId('footer-item-more'))
    fireEvent.press(getByTestId('footer-more-item-theme'))
    expect(getByTestId('footer-more-theme-back')).toBeTruthy()
    expect(getByTestId('footer-more-sheet-native')).toBeTruthy()
    fireEvent.press(getByTestId('footer-more-theme-back'))
    expect(getByTestId('footer-more-item-theme')).toBeTruthy()
  })

  it('«Выход» из листа после logout ведёт на главную, как desktop-меню', async () => {
    Object.assign(mockAuth, { isAuthenticated: true, userId: 7, username: 'Юля' })
    const { getByTestId, queryByTestId } = render(<BottomDock />)
    fireEvent.press(getByTestId('footer-item-more'))
    await act(async () => {
      fireEvent.press(getByTestId('footer-more-item-logout'))
    })
    expect(mockAuth.logout).toHaveBeenCalledTimes(1)
    expect(mockRouter.push).toHaveBeenCalledWith('/')
    expect(queryByTestId('footer-more-sheet-native')).toBeNull()
  })

  it('вошедший видит в листе счётчик непрочитанных у «Сообщений»', () => {
    Object.assign(mockAuth, { isAuthenticated: true, userId: 7, username: 'Юля' })
    const { getByTestId, getByText } = render(<BottomDock />)
    fireEvent.press(getByTestId('footer-item-more'))
    expect(getByTestId('footer-more-item-messages')).toBeTruthy()
    expect(getByText('Сообщения (3)')).toBeTruthy()
  })
})
