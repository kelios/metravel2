import React from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Link, router, type Href, type LinkProps } from 'expo-router'

export type LinkPressEvent = Parameters<NonNullable<LinkProps['onPress']>>[0]

type LinkPressableProps = Omit<PressableProps, 'onPress' | 'style'> & {
  href: Href
  onPress?: (event: LinkPressEvent) => void
  style?: StyleProp<ViewStyle>
  ref?: React.Ref<React.ComponentRef<typeof Pressable>>
}

type ClickLike = {
  button?: number | null
  metaKey?: boolean
  altKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
}

const isModifiedClick = (click: ClickLike | null | undefined) =>
  !!click && (!!(click.metaKey || click.altKey || click.ctrlKey || click.shiftKey)
    || (click.button != null && click.button !== 0))

// Семантика expo-router `shouldHandleMouseEvent` (из пакета не экспортируется):
// SPA-переход только для обычного левого клика без модификаторов и без target=_blank.
export function shouldHandleLinkClick(event: LinkPressEvent, allowBlankTarget = false): boolean {
  const click = event as unknown as ClickLike & {
    defaultPrevented?: boolean
    nativeEvent?: ClickLike
    currentTarget?: { target?: unknown } | null
  }
  if (click.defaultPrevented) return false
  if (isModifiedClick(click) || isModifiedClick(click.nativeEvent)) return false
  const target = click.currentTarget?.target
  return target == null || target === '' || target === 'self' || target === '_self'
    || (allowBlankTarget && target === '_blank')
}

// Pressable-ссылка: `<a href role=link>` из `Link asChild` и переход внутри приложения.
// На web Pressable из react-native-web затирает `onClick` от Link своим, который зовёт
// только `onPress`; поэтому `onPress` нельзя отдавать самому Link — он вытесняет его
// навигацию, и браузер уходит по `href` полной перезагрузкой (#2901). Обработчик живёт
// на ребёнке: Slot зовёт его раньше навигации Link, а после нашего `preventDefault`
// навигация Link ничего не делает. Slot сливает стиль спредом — отдаём плоский объект.
export default function LinkPressable({
  href,
  onPress,
  style,
  accessibilityRole = 'link',
  children,
  ...rest
}: LinkPressableProps) {
  const handleWebPress = (event: LinkPressEvent) => {
    onPress?.(event)
    if (!shouldHandleLinkClick(event)) return
    event.preventDefault()
    router.push(href)
  }

  return (
    <Link href={href} asChild>
      <Pressable
        {...rest}
        onPress={Platform.OS === 'web' ? handleWebPress : onPress}
        accessibilityRole={accessibilityRole}
        style={StyleSheet.flatten(style)}
      >
        {children}
      </Pressable>
    </Link>
  )
}
