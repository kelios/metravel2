import React from 'react'
import { Pressable, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

type Props = {
  isWeb: boolean
  isSelected: boolean
  handlePress: () => void
  handleSelectableWebActivate: (event?: any, source?: 'click' | 'touch' | 'key') => void
  styles: Record<string, any>
  colors: {
    textOnPrimary: string
  }
}

export default function TravelListItemSelectableOverlay({
  isWeb,
  isSelected,
  handlePress,
  handleSelectableWebActivate,
  styles,
  colors,
}: Props) {
  const checkboxLabel = isSelected ? 'Убрать из выбранного' : 'Выбрать'

  return (
    <View style={[styles.checkWrap, { pointerEvents: 'auto' }] as any}>
      {isWeb ? (
        <View
          {...({
            role: 'checkbox',
            'aria-checked': isSelected,
            'aria-label': checkboxLabel,
            tabIndex: 0,
            testID: 'selection-checkbox',
            'data-testid': 'selection-checkbox',
            onClick: (e: MouseEvent) => {
              handleSelectableWebActivate(e, 'click')
            },
            onTouchEnd: (e: TouchEvent) => {
              handleSelectableWebActivate(e, 'touch')
            },
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              handleSelectableWebActivate(e, 'key')
            },
            onMouseDown: (e: MouseEvent) => e.stopPropagation?.(),
          } as any)}
          style={[styles.checkboxHitTarget ?? null, { cursor: 'pointer' } as any]}
        >
          <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
            {isSelected && <Feather name="check" size={14} color={colors.textOnPrimary} />}
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={checkboxLabel}
          testID="selection-checkbox"
          {...({ onPress: handlePress } as any)}
        >
          <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
            {isSelected && <Feather name="check" size={14} color={colors.textOnPrimary} />}
          </View>
        </Pressable>
      )}
    </View>
  )
}
