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
