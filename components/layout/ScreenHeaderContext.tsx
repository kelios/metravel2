import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { Platform } from 'react-native'
import { useFocusEffect } from 'expo-router'
import type Feather from '@expo/vector-icons/Feather'

import { useResponsive } from '@/hooks/useResponsive'
import type { ActionListSheetItem } from '@/components/ui/ActionListSheet'

import { resolveHeaderContextBarIsMobile } from './headerContextBarModel'

/**
 * #2099: контракт шапки вложенного экрана. Экран объявляет её ОДИН раз
 * (`useScreenHeader`), а представление выбирает ширина:
 *  - телефон — строка `HeaderContextBar`: «←», заголовок, (i), иконки действий;
 *  - desktop — `components/ui/ScreenHeader`: H1, описание и кнопки в теле страницы.
 * Один источник текста и действий, без копий в экранах.
 */
export type ScreenHeaderAction = {
  icon: keyof typeof Feather.glyphMap
  /** Полный текст действия: подпись кнопки на desktop, a11y-label и title иконки на телефоне. */
  label: string
  onPress: () => void
  testID?: string
}

export type ScreenHeaderConfig = {
  title: string
  /**
   * Абзацы пояснения. Первый — описание под H1 на desktop; все вместе — тело
   * листа (i) на телефоне (остальные абзацы на desktop живут в теле страницы).
   */
  info?: string[]
  primaryAction?: ScreenHeaderAction
  /** Доп. действия: кнопки на desktop, пункты «⋯» на телефоне. */
  actions?: ScreenHeaderAction[]
  overflow?: ActionListSheetItem[]
}

type Entry = { id: number; config: ScreenHeaderConfig }

let entries: Entry[] = []
let snapshot: ScreenHeaderConfig | null = null
let nextId = 1
const listeners = new Set<() => void>()

function publish() {
  snapshot = entries.length ? entries[entries.length - 1].config : null
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = () => snapshot
const getServerSnapshot = () => null

/** Шапка активного (сфокусированного) экрана; `null`, если экран её не объявил. */
export function useActiveScreenHeader(): ScreenHeaderConfig | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Тот же выбор «телефон/desktop», что у `HeaderContextBar`: строка и тело не рисуются вместе. */
export function useIsScreenHeaderMobile(): boolean {
  const { width, isPhone, isLargePhone, isHydrated } = useResponsive()
  // Статический HTML один на все вьюпорты, а до гидратации ширина 0 «выглядит»
  // телефоном: тогда h1 и описание не попали бы в сырой HTML. До гидратации web
  // считает «desktop» (как rowIsMobile в CustomHeader); телефон прячет десктопную
  // шапку CSS-медиазапросом `[data-screen-header]` (utils/criticalCSSBuilder.ts).
  if (Platform.OS === 'web' && (isHydrated === false || !width)) return false
  return resolveHeaderContextBarIsMobile({ width, isPhone, isLargePhone })
}

const signatureOf = (c: ScreenHeaderConfig) =>
  JSON.stringify([
    c.title,
    c.info ?? null,
    c.primaryAction ? [c.primaryAction.icon, c.primaryAction.label, c.primaryAction.testID ?? null] : null,
    (c.actions ?? []).map((a) => [a.icon, a.label, a.testID ?? null]),
    (c.overflow ?? []).map((o) => [o.key, o.label, o.icon, o.title ?? null]),
  ])

type ConfigRef = { current: ScreenHeaderConfig }

function buildStable(c: ScreenHeaderConfig, latest: ConfigRef): ScreenHeaderConfig {
  const wrap = (a: ScreenHeaderAction, pick: (x: ScreenHeaderConfig) => ScreenHeaderAction | undefined): ScreenHeaderAction => ({
    ...a,
    onPress: () => pick(latest.current)?.onPress(),
  })
  return {
    title: c.title,
    info: c.info,
    primaryAction: c.primaryAction ? wrap(c.primaryAction, (x) => x.primaryAction) : undefined,
    actions: c.actions?.map((a, i) => wrap(a, (x) => x.actions?.[i])),
    overflow: c.overflow?.map((o, i) => ({ ...o, onPress: () => latest.current.overflow?.[i]?.onPress() })),
  }
}

/**
 * Объявляет шапку экрана. Регистрация живёт, пока экран в фокусе (стек и табы
 * держат неактивные экраны смонтированными, поэтому одного unmount мало).
 * Возвращает ту же декларацию — её отдают в `<ScreenHeader header={…} />`,
 * чтобы H1 desktop попадал и в SSR-разметку.
 */
export function useScreenHeader(config: ScreenHeaderConfig): ScreenHeaderConfig {
  const idRef = useRef(0)
  if (idRef.current === 0) idRef.current = nextId++
  const latest = useRef(config)
  latest.current = config
  const signature = signatureOf(config)

  // onPress читают из ref: смена замыкания не пересоздаёт запись и не будит строку.
  const cache = useRef<{ signature: string; value: ScreenHeaderConfig } | null>(null)
  if (!cache.current || cache.current.signature !== signature) {
    cache.current = { signature, value: buildStable(config, latest) }
  }
  const stable = cache.current.value

  useFocusEffect(
    useCallback(() => {
      const id = idRef.current
      entries = entries.filter((e) => e.id !== id)
      entries.push({ id, config: stable })
      publish()
      return () => {
        entries = entries.filter((e) => e.id !== id)
        publish()
      }
    }, [stable]),
  )

  useEffect(
    () => () => {
      const id = idRef.current
      if (entries.some((e) => e.id === id)) {
        entries = entries.filter((e) => e.id !== id)
        publish()
      }
    },
    [],
  )

  return config
}

/** Только для тестов. */
export function resetScreenHeaderForTests() {
  entries = []
  publish()
}
