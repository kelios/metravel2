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
import { BOTTOM_DOCK_MORE_MENU_SECTIONS } from '@/components/layout/bottomDockModel'
import { buildBottomDockMoreSections } from '@/components/layout/bottomDockMoreSections'
import { openExternalUrl } from '@/utils/externalLinks'

// #2152: ролевой пункт аккаунта обязан быть на КАЖДОЙ поверхности меню —
// desktop-меню, гамбургер шапки и лист «Ещё» дока. После #2100 гамбургера на
// вложенных экранах телефона нет, и «Борд задач» админа пропал: третья
// поверхность держала свой статический список. Guard семейства: новый ролевой
// пункт, добавленный мимо `buildAccountRoleEntries`, краснеет здесь.

const mockAuth = { isSuperuser: false, logout: jest.fn(async () => undefined) }
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

const renderMoreList = (isSuperuser: boolean) =>
  render(
    <BottomDockMoreList
      styles={listStyles}
      iconColor="#000"
      isSuperuser={isSuperuser}
      itemFilter={() => true}
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

  it('лист «Ещё» дока содержит каждый ролевой пункт отдельной секцией только у суперпользователя', () => {
    const roleSection = buildBottomDockMoreSections({ isSuperuser: true }).find((section) => section.key === 'role')
    expect(roleSection?.items).toEqual(
      roleEntries.map((entry) => expect.objectContaining({ key: entry.key, label: entry.title, accountTarget: entry.target })),
    )
    expect(buildBottomDockMoreSections({ isSuperuser: false })).toBe(BOTTOM_DOCK_MORE_MENU_SECTIONS)
  })

  it('BottomDockMoreList рисует «Борд задач» админу и не рисует обычному', () => {
    expect(renderMoreList(true).getByTestId('footer-more-item-task-board')).toBeTruthy()
    expect(renderMoreList(false).queryByTestId('footer-more-item-task-board')).toBeNull()
  })

  it('тап по «Борду задач» в листе «Ещё» на вложенном экране открывает борд внешней ссылкой', () => {
    mockAuth.isSuperuser = true
    const { getByTestId, queryByTestId } = render(<BottomDock />)
    fireEvent.press(getByTestId('footer-item-more'))
    fireEvent.press(getByTestId('footer-more-item-task-board'))

    expect(openExternalUrl).toHaveBeenCalledWith(TASK_BOARD_URL)
    expect(mockRouter.push).not.toHaveBeenCalled()
    expect(queryByTestId('footer-more-sheet-native')).toBeNull()
  })

  it('у обычного пользователя в листе «Ещё» дока борда нет', () => {
    const { getByTestId, queryByTestId } = render(<BottomDock />)
    fireEvent.press(getByTestId('footer-item-more'))
    expect(getByTestId('footer-more-sheet-native')).toBeTruthy()
    expect(queryByTestId('footer-more-item-task-board')).toBeNull()
  })
})
