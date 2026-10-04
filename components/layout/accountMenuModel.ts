import type { NavigationIconName } from '@/constants/navigationIcons'
import { isNavRouteAvailable } from '@/constants/platformNavRoutes'
import { buildLoginHref } from '@/utils/authNavigation'
import { trackRegisterCtaClicked } from '@/utils/growthFunnelAnalytics'
import { routes } from '@/utils/routes'
import { translate as i18nT } from '@/i18n'

// Единый источник пунктов меню аккаунта для desktop (AccountMenu) и мобильного
// меню шапки (CustomHeaderMobileMenu). Раньше каждый рендерер держал свой
// список, и мобильный дрейфовал: «Борд задач» админа, «Подписки» и «Публичный
// профиль» попали только в desktop (#2139). Рендереры отвечают лишь за вид.
// Ролевые пункты (`buildAccountRoleEntries`) берёт и лист «Ещё» дока (#2152).

export const TASK_BOARD_URL = 'https://metravel.by/board'

export type AccountMenuSurface = 'desktop' | 'mobile'

export type AccountMenuTarget =
  | { kind: 'route'; path: string }
  // Адрес входа строится в момент нажатия: redirect берётся из текущего
  // window.location, а desktop-модель мемоизирована и переживает SPA-переходы.
  | { kind: 'login' }
  | { kind: 'register'; path: string }
  | { kind: 'external'; url: string }
  | { kind: 'logout' }

export type AccountMenuEntry = {
  key: string
  title: string
  icon: NavigationIconName
  target: AccountMenuTarget
  accessibilityLabel?: string
  /** Непрочитанные сообщения: рендерер рисует бейдж и выделяет пункт. */
  unreadCount?: number
}

export type AccountMenuModel = {
  guest: AccountMenuEntry[]
  profile: AccountMenuEntry | null
  travels: AccountMenuEntry[]
  account: AccountMenuEntry[]
}

export type AccountMenuInput = {
  surface: AccountMenuSurface
  /** `Platform.OS`: маршруты, недоступные на платформе, отсекает общая политика `isNavRouteAvailable` (#2135). */
  platform: string
  isAuthenticated: boolean
  isSuperuser?: boolean
  userId?: string | number | null
  username?: string | null
  favoritesCount: number
  unreadCount: number
}

const buildGuestEntries = (): AccountMenuEntry[] => [
  {
    key: 'login',
    title: i18nT('navigation:components.layout.AccountMenu.voyti_d3fdfdb5'),
    icon: 'log-in',
    target: { kind: 'login' },
  },
  {
    key: 'registration',
    title: i18nT('navigation:components.layout.AccountMenu.zaregistrirovatsya_36130f31'),
    icon: 'user-plus',
    target: { kind: 'register', path: '/registration' },
  },
]

const buildProfileEntry = ({ username, favoritesCount }: AccountMenuInput): AccountMenuEntry => ({
  key: 'profile',
  title: i18nT('navigation:components.layout.AccountMenu.lichnyy_kabinet_value1_30ade467', {
    value1: favoritesCount > 0 ? ` (${favoritesCount})` : '',
  }),
  icon: 'user',
  target: { kind: 'route', path: '/profile' },
  accessibilityLabel: username
    ? i18nT('navigation:components.layout.CustomHeaderMobileMenu.lichnyy_kabinet_value1_e241654e', { value1: username })
    : i18nT('navigation:components.layout.CustomHeaderMobileMenu.lichnyy_kabinet_b728bc9e'),
})

const buildTravelEntries = (): AccountMenuEntry[] => [
  {
    key: 'travel-new',
    title: i18nT('navigationStatic:components.layout.AccountMenu.dobavit_puteshestvie_bebd3820'),
    icon: 'plus-circle',
    target: { kind: 'route', path: '/travel/new' },
  },
  {
    key: 'my-travels',
    title: i18nT('navigationStatic:components.layout.AccountMenu.moi_puteshestviya_a530e844'),
    icon: 'map',
    target: { kind: 'route', path: '/metravel' },
  },
  {
    key: 'user-points',
    title: i18nT('navigationStatic:components.layout.AccountMenu.moi_tochki_902be7fb'),
    icon: 'map-pin',
    target: { kind: 'route', path: '/userpoints' },
  },
]

/**
 * Ролевые пункты аккаунта — единственное место, где роль становится пунктом
 * меню. Их обязана показывать КАЖДАЯ поверхность меню: desktop, гамбургер шапки
 * и лист «Ещё» нижнего дока (#2152: после #2100 гамбургера на вложенных экранах
 * нет, и «Борд задач» админа пропал). Состав поверхностей сверяет jest-guard
 * `accountMenuModel.roleSurfaces.test.tsx`.
 */
export const buildAccountRoleEntries = ({ isSuperuser }: Pick<AccountMenuInput, 'isSuperuser'>): AccountMenuEntry[] =>
  isSuperuser
    ? [
        {
          key: 'task-board',
          title: i18nT('navigation:components.layout.AccountMenu.bord_zadach_c032c12d'),
          icon: 'trello',
          target: { kind: 'external', url: TASK_BOARD_URL },
        },
      ]
    : []

const buildAccountEntries = ({
  surface,
  platform,
  isSuperuser,
  userId,
  unreadCount,
}: AccountMenuInput): AccountMenuEntry[] => {
  const entries: AccountMenuEntry[] = [
    {
      key: 'messages',
      title: unreadCount > 0
        ? i18nT('navigation:components.layout.AccountMenu.soobscheniya_value1_a08d8c49', { value1: unreadCount })
        : i18nT('navigation:components.layout.AccountMenu.soobscheniya_644700aa'),
      icon: 'mail',
      target: { kind: 'route', path: '/messages' },
      accessibilityLabel: unreadCount > 0
        ? i18nT('navigation:components.layout.CustomHeaderMobileMenu.soobscheniya_value1_neprochitannyh_06035ae9', { value1: unreadCount })
        : undefined,
      unreadCount,
    },
    {
      key: 'subscriptions',
      title: i18nT('navigation:components.layout.AccountMenu.podpiski_980979f1'),
      icon: 'user-check',
      target: { kind: 'route', path: '/subscriptions' },
    },
  ]

  // Экспорт в PDF («Книга путешествий») скрыт в мобильной версии сайта; на native
  // его отсекает общая политика маршрутов (#495, #2135) — фильтр в конце.
  if (surface === 'desktop') {
    entries.push({
      key: 'export',
      title: i18nT('navigation:components.layout.AccountMenu.eksport_v_pdf_234b675b'),
      icon: 'file-text',
      target: { kind: 'route', path: '/export' },
    })
  }

  if (userId) {
    entries.push({
      key: 'public-profile',
      title: i18nT('navigation:components.layout.AccountMenu.publichnyy_profil_b0c7fc3b'),
      icon: 'globe',
      target: { kind: 'route', path: routes.user(userId) as string },
    })
  }

  entries.push(...buildAccountRoleEntries({ isSuperuser }))

  entries.push({
    key: 'logout',
    title: i18nT('navigation:components.layout.AccountMenu.vyhod_fc2f589e'),
    icon: 'log-out',
    target: { kind: 'logout' },
  })

  return entries.filter((entry) => entry.target.kind !== 'route' || isNavRouteAvailable(entry.target.path, platform))
}

export const buildAccountMenuModel = (input: AccountMenuInput): AccountMenuModel =>
  input.isAuthenticated
    ? {
        guest: [],
        profile: buildProfileEntry(input),
        travels: buildTravelEntries(),
        account: buildAccountEntries(input),
      }
    : { guest: buildGuestEntries(), profile: null, travels: [], account: [] }

const REGISTER_CTA_SOURCE: Record<AccountMenuSurface, string> = {
  desktop: 'account_menu',
  mobile: 'mobile_menu',
}

export type AccountMenuTargetHandlers = {
  navigate: (path: string) => void
  openExternal: (url: string) => void
  logout: () => void
}

export const runAccountMenuTarget = (
  target: AccountMenuTarget,
  surface: AccountMenuSurface,
  handlers: AccountMenuTargetHandlers,
) => {
  switch (target.kind) {
    case 'route':
      handlers.navigate(target.path)
      return
    case 'login':
      handlers.navigate(buildLoginHref({ intent: 'menu' }))
      return
    case 'register':
      trackRegisterCtaClicked({ source: REGISTER_CTA_SOURCE[surface], intent: 'menu', authState: 'guest' })
      handlers.navigate(target.path)
      return
    case 'external':
      handlers.openExternal(target.url)
      return
    case 'logout':
      handlers.logout()
  }
}
