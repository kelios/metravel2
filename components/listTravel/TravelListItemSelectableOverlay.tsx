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
  return (
    <View style={[styles.checkWrap, { pointerEvents: 'auto' }] as any}>
      {isWeb ? (
        React.createElement(
          'div',
          {
            role: 'checkbox',
            'aria-checked': isSelected,
            'aria-label': isSelected ? 'Убрать из выбранного' : 'Выбрать',
            tabIndex: 0,
            testID: 'selection-checkbox',
            'data-testid': 'selection-checkbox',
            onClick: (e: MouseEvent) => {
              handleSelectableWebActivate(e, 'click')
            },
            onTouchStart: (e: TouchEvent) => {
              e.stopPropagation?.()
            },
            onTouchEnd: (e: TouchEvent) => {
              handleSelectableWebActivate(e, 'touch')
            },
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              handleSelectableWebActivate(e, 'key')
            },
            onMouseDown: (e: MouseEvent) => e.stopPropagation?.(),
            style: { cursor: 'pointer' },
          },
          <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
            {isSelected && <Feather name="check" size={14} color={colors.textOnPrimary} />}
          </View>,
        )
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isSelected ? 'Убрать из выбранного' : 'Выбрать'}
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
