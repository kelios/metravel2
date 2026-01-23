import React, { useCallback, useRef } from 'react'
import { Platform, Pressable, StyleSheet, TouchableOpacity } from 'react-native'

export const DeleteAction: React.FC<{
  onActivate: () => void
  style?: any
  testID?: string
  children: React.ReactNode
}> = ({ onActivate, style, testID, children }) => {
  const lastActivateTsRef = useRef<number | null>(null)

  const makeActivate = useCallback(
    (e?: any) => {
      try {
        e?.stopPropagation?.()
        e?.preventDefault?.()

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
    const flatStyle = StyleSheet.flatten(style)

    return (
      <Pressable
        onPress={makeActivate}
        style={{
          ...flatStyle,
          borderWidth: 0,
          backgroundColor: flatStyle?.backgroundColor || 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textDecorationLine: 'none',
        }}
        accessibilityRole="button"
        testID={testID}
      >
        {children}
      </Pressable>
    )
  }

  return (
    <TouchableOpacity onPress={onActivate} style={style} testID={testID}>
      {children}
    </TouchableOpacity>
  )
}
