import React, { useCallback, useRef } from 'react'
import { Platform, Pressable, StyleSheet, TouchableOpacity, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native'

import type { createGalleryStyles } from './styles'

// Gallery styles include web-only CSS (cursor/:hover/backdropFilter) on the
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
  testID?: string
  accessibilityLabel?: string
  children: React.ReactNode
}> = ({ onActivate, style, testID, accessibilityLabel = 'Удалить фото', children }) => {
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

    return (
      <Pressable
        onPress={makeActivate}
        style={webStyle}
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
