import { Platform } from 'react-native'

import {
  buildAccountMenuModel,
  runAccountMenuTarget,
  TASK_BOARD_URL,
  type AccountMenuInput,
  type AccountMenuModel,
} from '@/components/layout/accountMenuModel'
import { trackRegisterCtaClicked } from '@/utils/growthFunnelAnalytics'

jest.mock('@/utils/growthFunnelAnalytics', () => ({
  trackRegisterCtaClicked: jest.fn(),
}))

const base: AccountMenuInput = {
  surface: 'desktop',
  isWeb: true,
  isAuthenticated: true,
  isSuperuser: false,
  userId: 7,
  username: 'Юля',
  favoritesCount: 0,
  unreadCount: 0,
}

const keysOf = (model: AccountMenuModel) => [
  ...model.guest,
  ...(model.profile ? [model.profile] : []),
  ...model.travels,
  ...model.account,
].map((entry) => entry.key)

describe('accountMenuModel (#2139)', () => {
  it('«Борд задач» есть у суперпользователя на обеих поверхностях и ведёт на внешний борд', () => {
    for (const surface of ['desktop', 'mobile'] as const) {
      const model = buildAccountMenuModel({ ...base, surface, isSuperuser: true })
      const board = model.account.find((entry) => entry.key === 'task-board')
      expect({ surface, target: board?.target }).toEqual({
        surface,
        target: { kind: 'external', url: TASK_BOARD_URL },
      })
    }
  })

  it('обычному пользователю борд не показывается', () => {
    for (const surface of ['desktop', 'mobile'] as const) {
      expect(keysOf(buildAccountMenuModel({ ...base, surface }))).not.toContain('task-board')
    }
  })

  it('desktop и mobile отличаются только экспортом PDF (только desktop web)', () => {
    const desktop = keysOf(buildAccountMenuModel({ ...base, isSuperuser: true }))
    const mobile = keysOf(buildAccountMenuModel({ ...base, surface: 'mobile', isSuperuser: true }))
    const desktopNative = keysOf(buildAccountMenuModel({ ...base, isWeb: false, isSuperuser: true }))

    expect(desktop.filter((key) => key !== 'export')).toEqual(mobile)
    expect(desktop).toContain('export')
    expect(desktopNative).not.toContain('export')
    expect(mobile).toEqual([
      'profile',
      'travel-new',
      'my-travels',
      'user-points',
      'messages',
      'subscriptions',
      'public-profile',
      'task-board',
      'logout',
    ])
  })

  it('публичный профиль ведёт на страницу пользователя и скрыт без userId', () => {
    const model = buildAccountMenuModel({ ...base, userId: 42 })
    expect(model.account.find((entry) => entry.key === 'public-profile')?.target).toEqual({
      kind: 'route',
      path: '/user/42',
    })
    expect(keysOf(buildAccountMenuModel({ ...base, userId: null }))).not.toContain('public-profile')
  })

  it('гость видит только вход и регистрацию', () => {
    const model = buildAccountMenuModel({ ...base, isAuthenticated: false, isSuperuser: true })
    expect(keysOf(model)).toEqual(['login', 'registration'])
  })

  it('вход берёт redirect из адреса на момент нажатия, а не на момент сборки модели', () => {
    const originalOS = Platform.OS
    const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    try {
      window.history.pushState({}, '', '/travels/old')
      const model = buildAccountMenuModel({ ...base, isAuthenticated: false })
      const login = model.guest.find((entry) => entry.key === 'login')
      expect(login?.target).toEqual({ kind: 'login' })

      // Шапка с мемоизированной моделью переживает SPA-переход.
      window.history.pushState({}, '', '/search?q=1')
      const handlers = { navigate: jest.fn(), openExternal: jest.fn(), logout: jest.fn() }
      runAccountMenuTarget(login!.target, 'desktop', handlers)
      expect(handlers.navigate).toHaveBeenCalledWith('/login?redirect=%2Fsearch%3Fq%3D1&intent=menu')
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS })
      window.history.pushState({}, '', originalUrl)
    }
  })

  it('исполнитель целей: регистрация шлёт событие с источником поверхности, борд — во внешнюю ссылку', () => {
    const handlers = { navigate: jest.fn(), openExternal: jest.fn(), logout: jest.fn() }

    runAccountMenuTarget({ kind: 'register', path: '/registration' }, 'mobile', handlers)
    expect(trackRegisterCtaClicked).toHaveBeenCalledWith({ source: 'mobile_menu', intent: 'menu', authState: 'guest' })
    expect(handlers.navigate).toHaveBeenCalledWith('/registration')

    runAccountMenuTarget({ kind: 'external', url: TASK_BOARD_URL }, 'desktop', handlers)
    expect(handlers.openExternal).toHaveBeenCalledWith(TASK_BOARD_URL)

    runAccountMenuTarget({ kind: 'logout' }, 'desktop', handlers)
    expect(handlers.logout).toHaveBeenCalledTimes(1)
  })
})
