import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { Pressable, Text } from 'react-native'

import BottomDock from '@/components/layout/BottomDock'
import BottomDockMoreList from '@/components/layout/BottomDockMoreList'
import {
  buildAccountMenuModel,
  buildAccountRoleEntries,
  TASK_BOARD_URL,
  type AccountMenuInput,
  type AccountMenuSurface,
} from '@/components/layout/accountMenuModel'
import { buildBottomDockMoreSections } from '@/components/layout/bottomDockMoreSections'
import { openExternalUrl } from '@/utils/externalLinks'

// #2152: ролевой пункт аккаунта обязан быть на КАЖДОЙ поверхности меню —
// desktop-меню и лист «Ещё» дока. После #2100 гамбургера на вложенных экранах
// телефона не было, и «Борд задач» админа пропал: лист держал свой статический
// список. С #2779 лист — единственное меню телефона (кнопка шапки открывает его же),
// и ролевые пункты приходят в нём секцией аккаунта из общей модели. Guard
// семейства: новый ролевой пункт, добавленный мимо `buildAccountRoleEntries`,
// краснеет здесь.

const mockAuth = { isAuthenticated: true, isSuperuser: false, userId: 7, username: 'admin', logout: jest.fn(async () => undefined) }
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => mockAuth,
}))
const mockRouter = { push: jest.fn(), navigate: jest.fn() }
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/quests/minsk/old-town',
  useFocusEffect: (effect: () => undefined | (() => void)) => {
    const ReactLib = require('react')
    ReactLib.useEffect(() => effect(), [effect])
  },
}))
jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: jest.fn(async () => true),
  openExternalUrlInNewTab: jest.fn(),
}))
jest.mock('@/hooks/useDeferredUnreadCount', () => ({
  useDeferredUnreadCount: () => ({ count: 0 }),
}))
jest.mock('@/utils/growthFunnelAnalytics', () => ({
  trackRegisterCtaClicked: jest.fn(),
}))

const base: Omit<AccountMenuInput, 'surface' | 'platform'> = {
  isAuthenticated: true,
  isSuperuser: true,
  userId: 7,
  username: 'admin',
  favoritesCount: 0,
  unreadCount: 0,
}

const listStyles = { moreList: {}, moreListContent: {}, moreDivider: {}, moreItem: {}, moreItemText: {} }

const renderMoreList = async (isSuperuser: boolean) =>
  await render(
    <BottomDockMoreList
      styles={listStyles}
      iconColor="#000"
      account={{ isAuthenticated: true, isSuperuser, userId: 7, username: 'admin' }}
      onClose={jest.fn()}
      renderItem={(item) => (
        <Pressable key={item.key} testID={`footer-more-item-${item.key}`}>
          <Text>{item.label}</Text>
        </Pressable>
      )}
    />,
  )

describe('ролевые пункты аккаунта на всех поверхностях меню (#2152)', () => {
  const roleEntries = buildAccountRoleEntries({ isSuperuser: true })

  beforeEach(() => {
    mockAuth.isSuperuser = false
    jest.clearAllMocks()
  })

  it('у суперпользователя есть хотя бы «Борд задач», у обычного — ничего', () => {
    expect(roleEntries.map((entry) => entry.key)).toContain('task-board')
    expect(roleEntries).toContainEqual(expect.objectContaining({
      key: 'app-stats',
      target: { kind: 'route', path: '/app-stats' },
    }))
    expect(buildAccountRoleEntries({ isSuperuser: false })).toEqual([])
  })

  it.each<[AccountMenuSurface, string]>([
    ['desktop', 'web'],
    ['mobile', 'web'],
    ['mobile', 'ios'],
    ['mobile', 'android'],
  ])('меню аккаунта %s/%s содержит каждый ролевой пункт', (surface, platform) => {
    const account = buildAccountMenuModel({ ...base, surface, platform }).account
    for (const entry of roleEntries) {
      expect(account).toContainEqual(expect.objectContaining({ key: entry.key, target: entry.target }))
    }
  })

  it('лист «Ещё» дока содержит каждый ролевой пункт в секции аккаунта только у суперпользователя', () => {
    const accountOf = (isSuperuser: boolean) =>
      buildBottomDockMoreSections({ isAuthenticated: true, isSuperuser, userId: 7, username: 'admin' }, 'ios')
        .find((section) => section.key === 'account')?.items ?? []
    expect(accountOf(true)).toEqual(
      expect.arrayContaining(
        roleEntries.map((entry) => expect.objectContaining({ key: entry.key, label: entry.title, accountTarget: entry.target })),
      ),
    )
    const regularKeys = accountOf(false).map((item) => item.key)
    for (const entry of roleEntries) expect(regularKeys).not.toContain(entry.key)
  })

  it('BottomDockMoreList рисует «Борд задач» админу и не рисует обычному', async () => {
    expect(await (await renderMoreList(true)).getByTestId('footer-more-item-task-board')).toBeTruthy()
    expect(await (await renderMoreList(false)).queryByTestId('footer-more-item-task-board')).toBeNull()
  })

  it('BottomDockMoreList рисует «Instagram: афишу» админу и не рисует обычному', async () => {
    expect(await (await renderMoreList(true)).getByTestId('footer-more-item-instagram-schedule')).toBeTruthy()
    expect(await (await renderMoreList(false)).queryByTestId('footer-more-item-instagram-schedule')).toBeNull()
  })

  it('тап по «Статистике приложения» в листе «Ещё» открывает экран маршрутом', async () => {
    mockAuth.isSuperuser = true
    const { getByTestId } = await render(<BottomDock />)
    await fireEvent.press(getByTestId('footer-item-more'))
    await fireEvent.press(getByTestId('footer-more-item-app-stats'))

    expect(mockRouter.push).toHaveBeenCalledWith('/app-stats')
    expect(openExternalUrl).not.toHaveBeenCalled()
  })

  it('тап по «Борду задач» в листе «Ещё» на вложенном экране открывает борд внешней ссылкой', async () => {
    mockAuth.isSuperuser = true
    const { getByTestId, queryByTestId } = await render(<BottomDock />)
    await fireEvent.press(getByTestId('footer-item-more'))
    await fireEvent.press(getByTestId('footer-more-item-task-board'))

    expect(openExternalUrl).toHaveBeenCalledWith(TASK_BOARD_URL)
    expect(mockRouter.push).not.toHaveBeenCalled()
    expect(queryByTestId('footer-more-sheet-native')).toBeNull()
  })

  it('у обычного пользователя в листе «Ещё» дока борда нет', async () => {
    const { getByTestId, queryByTestId } = await render(<BottomDock />)
    await fireEvent.press(getByTestId('footer-item-more'))
    expect(getByTestId('footer-more-sheet-native')).toBeTruthy()
    expect(queryByTestId('footer-more-item-task-board')).toBeNull()
  })
})
