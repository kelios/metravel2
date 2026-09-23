import React, { useCallback, useRef } from 'react'
import { Platform, Pressable, StyleSheet, TouchableOpacity, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native'

import type { createGalleryStyles } from './styles'
import { translate as i18nT } from '@/i18n'


// Gallery styles include web-only CSS (cursor/backdropFilter/boxShadow) on the
// interactive entries, so the accepted style is the factory's own value type
// plus the nested arrays the gallery passes — not a plain ViewStyle.
type GalleryStyleValue = ReturnType<typeof createGalleryStyles>[keyof ReturnType<typeof createGalleryStyles>]
export type DeleteActionStyle =
  | StyleProp<ViewStyle>
  | GalleryStyleValue
  | ReadonlyArray<GalleryStyleValue | false | null | undefined>

export const DeleteAction: React.FC<{
  onActivate: () => void
  style?: DeleteActionStyle
  /**
   * Web: вид под курсором мыши и при нажатии мышью (#2036). Состояние `hovered` RNW
   * отдаёт только мыши, поэтому касание на mobile web этих стилей не получает.
   */
  hoverStyle?: DeleteActionStyle
  mousePressStyle?: DeleteActionStyle
  testID?: string
  accessibilityLabel?: string
  children: React.ReactNode
}> = ({ onActivate, style, hoverStyle, mousePressStyle, testID, accessibilityLabel = i18nT('travel:components.travel.gallery.DeleteAction.udalit_foto_0125fa97'), children }) => {
  const lastActivateTsRef = useRef<number | null>(null)

  const makeActivate = useCallback(
    (e?: GestureResponderEvent) => {
      try {
        e?.stopPropagation?.()
        ;(e as { preventDefault?: () => void } | undefined)?.preventDefault?.()

        const now = Date.now()
        const last = lastActivateTsRef.current
        if (last && now - last < 250) {
          return
        }
        lastActivateTsRef.current = now
        onActivate()
      } catch {
        void 0
      }
    },
    [onActivate]
  )

  if (Platform.OS === 'web') {
    const flatStyle = StyleSheet.flatten(style as StyleProp<ViewStyle>)

    // Web-only inline style mixes CSS props (cursor/display/textDecorationLine)
    // that are not part of RN ViewStyle, so this merge is cast at the boundary.
    const webStyle = {
      ...flatStyle,
      borderWidth: 0,
      backgroundColor: flatStyle?.backgroundColor || 'transparent',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textDecorationLine: 'none',
    } as StyleProp<ViewStyle>
    // `webStyle` уходит инлайном, поэтому и отклик мыши кладётся поверх него инлайном
    // (плоским объектом): так «последний выигрывает» без смешения с классами StyleSheet.
    const flatHoverStyle = hoverStyle ? StyleSheet.flatten(hoverStyle as StyleProp<ViewStyle>) : null
    const flatMousePressStyle = mousePressStyle ? StyleSheet.flatten(mousePressStyle as StyleProp<ViewStyle>) : null

    return (
      <Pressable
        onPress={makeActivate}
        style={({ hovered, pressed }) =>
          hovered ? [webStyle, flatHoverStyle, pressed && flatMousePressStyle] : webStyle
        }
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        {children}
      </Pressable>
    )
  }

  return (
    <TouchableOpacity onPress={onActivate} style={style as StyleProp<ViewStyle>} testID={testID}>
      {children}
    </TouchableOpacity>
  )
}
