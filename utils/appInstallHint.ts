import { Platform } from 'react-native'

import type { AppStorePlatform } from '@/constants/appStore'

/**
 * Правила показа ненавязчивой подсказки «поставьте приложение» на mobile web.
 *
 * Логика вынесена из компонента отдельно, потому что она чистая и проверяется
 * юнит-тестами: UA-детект, частотный кап и cooldown после закрытия — это то,
 * что легко сломать при следующей правке баннера.
 */

const STORAGE_KEY = 'metravel_app_install_hint_v1'

/** Сколько молчим после того, как пользователь закрыл подсказку. */
export const DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000

/** Сколько раз всего допустимо показать подсказку тому, кто её закрывает. */
export const MAX_DISMISSALS = 2

export type AppInstallHintState = {
  /** Время последнего закрытия крестиком, ms. */
  dismissedAt?: number
  /** Сколько раз пользователь закрывал подсказку. */
  dismissCount?: number
  /** Время перехода в витрину приложения — после него подсказку не показываем никогда. */
  installClickedAt?: number
}

export type AppInstallHintContext = {
  userAgent: string
  /** Узкий вьюпорт: подсказка адресована телефону, а не десктопу с мобильным UA. */
  isMobileViewport: boolean
  /** `document.referrer`: переход из установленного приложения — повод молчать. */
  referrer?: string
  /** Сайт открыт как установленное PWA. */
  isStandalone?: boolean
  state: AppInstallHintState | null
  now: number
}

/**
 * Android-телефон, а не планшет: планшетный Chrome отдаёт UA без токена `Mobile`.
 */
export const isAndroidPhoneUserAgent = (userAgent: string): boolean => {
  const normalized = String(userAgent || '')
  if (!/android/i.test(normalized)) return false
  return /mobile/i.test(normalized)
}

/** iPhone/iPod. iPad сюда не входит: плашка адресована телефону. */
export const isIPhoneUserAgent = (userAgent: string): boolean =>
  /iPhone|iPod/i.test(String(userAgent || ''))

/**
 * Витрина, в которую ведёт подсказка на телефоне: App Store для iPhone,
 * Google Play для Android-телефона, `null` — подсказка не адресована.
 */
export const getPhoneStorePlatform = (userAgent: string): AppStorePlatform | null => {
  if (isIPhoneUserAgent(userAgent)) return 'ios'
  if (isAndroidPhoneUserAgent(userAgent)) return 'android'
  return null
}

type StoreDetectionNavigator = { userAgent?: string; maxTouchPoints?: number }

/**
 * Витрина устройства для кнопок скачивания: iPhone и iPad (в том числе iPadOS,
 * который представляется десктопным Safari, но с сенсорным экраном) — App Store,
 * Android — Google Play, остальное (десктоп) — `null`, показываем обе витрины.
 */
export const detectStorePlatform = (nav: StoreDetectionNavigator | null | undefined): AppStorePlatform | null => {
  const userAgent = String(nav?.userAgent || '')
  if (/iPhone|iPod|iPad/i.test(userAgent)) return 'ios'
  if (/Macintosh/i.test(userAgent) && Number(nav?.maxTouchPoints ?? 0) > 1) return 'ios'
  if (/android/i.test(userAgent)) return 'android'
  return null
}

export const shouldOfferAppInstall = (context: AppInstallHintContext): boolean => {
  if (!getPhoneStorePlatform(context.userAgent)) return false
  if (!context.isMobileViewport) return false
  if (context.isStandalone) return false
  if (String(context.referrer || '').startsWith('android-app://')) return false

  const state = context.state
  if (!state) return true
  if (state.installClickedAt) return false
  if ((state.dismissCount ?? 0) >= MAX_DISMISSALS) return false
  if (state.dismissedAt && context.now - state.dismissedAt < DISMISS_COOLDOWN_MS) return false

  return true
}

const canUseStorage = (): boolean =>
  Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

export const readAppInstallHintState = (): AppInstallHintState | null => {
  if (!canUseStorage()) return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null

    const candidate = parsed as Record<string, unknown>
    const state: AppInstallHintState = {}
    if (typeof candidate.dismissedAt === 'number') state.dismissedAt = candidate.dismissedAt
    if (typeof candidate.dismissCount === 'number') state.dismissCount = candidate.dismissCount
    if (typeof candidate.installClickedAt === 'number') {
      state.installClickedAt = candidate.installClickedAt
    }
    return state
  } catch {
    return null
  }
}

const writeAppInstallHintState = (state: AppInstallHintState): void => {
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Приватный режим/переполненное хранилище: подсказка просто покажется снова.
  }
}

export const markAppInstallHintDismissed = (now: number = Date.now()): AppInstallHintState => {
  const previous = readAppInstallHintState() ?? {}
  const next: AppInstallHintState = {
    ...previous,
    dismissedAt: now,
    dismissCount: (previous.dismissCount ?? 0) + 1,
  }
  writeAppInstallHintState(next)
  return next
}

export const markAppInstallHintConverted = (now: number = Date.now()): AppInstallHintState => {
  const previous = readAppInstallHintState() ?? {}
  const next: AppInstallHintState = { ...previous, installClickedAt: now }
  writeAppInstallHintState(next)
  return next
}

export const isStandaloneDisplayMode = (): boolean => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false
  try {
    if (typeof window.matchMedia === 'function') {
      if (window.matchMedia('(display-mode: standalone)').matches) return true
      if (window.matchMedia('(display-mode: fullscreen)').matches) return true
    }
  } catch {
    // matchMedia недоступен — считаем обычной вкладкой.
  }
  return Boolean((window.navigator as { standalone?: boolean } | undefined)?.standalone)
}
