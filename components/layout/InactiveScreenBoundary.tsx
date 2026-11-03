import React, { type ReactNode } from 'react'
import { Platform } from 'react-native'
import { useIsFocused } from 'expo-router'

/**
 * #2910: неактивные экраны web-навигатора не участвуют в странице.
 *
 * Tabs-навигатор на web держит посещённые экраны смонтированными
 * (`expo-router/build/react-navigation/bottom-tabs/views/BottomTabView.js`):
 * `react-native-screens` на web выключен, и `MaybeScreen` рисует прежний экран
 * обычным `View` с `absoluteFill` и `zIndex: -1` — визуально он под текущим, но
 * его кнопки («Добавить в план» ×17 из `/search`) оставались в дереве
 * доступности, в Tab-обходе и в тексте страницы после перехода в статью.
 *
 * Размонтировать прежний экран нельзя: «Назад» из статьи обязан вернуть поиск
 * с его состоянием и прокруткой (`backBehavior: 'fullHistory'`). Поэтому экран
 * остаётся в DOM, но становится `inert` + `aria-hidden`: браузер исключает его
 * из фокуса, кликов и дерева скринридера. `display: none` также исключает
 * отрисовку прежнего экрана. В фокусе `display: contents` сохраняет раскладку.
 * Одна и та же обёртка сохраняет дерево экрана при смене фокуса и гидрации.
 */
export function inactiveScreenWebAttributes(isFocused: boolean) {
  if (Platform.OS !== 'web' || isFocused) return null
  return { 'aria-hidden': 'true', inert: true } as const
}

export function InactiveScreenBoundary({ children }: { children: ReactNode }) {
  const isFocused = useIsFocused()
  if (Platform.OS !== 'web') return <>{children}</>
  return React.createElement(
    'div',
    {
      'data-screen-boundary': isFocused ? 'active' : 'inactive',
      style: { display: isFocused ? 'contents' : 'none' },
      ...inactiveScreenWebAttributes(isFocused),
    },
    children,
  )
}

/** `screenLayout` навигатора: каждый экран — внутри своей границы (только web). */
export const renderInactiveScreenBoundary = ({ children }: { children: ReactNode }) => (
  <InactiveScreenBoundary>{children}</InactiveScreenBoundary>
)
