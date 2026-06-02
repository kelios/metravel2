import React from 'react'
import { View } from 'react-native'

import type { ThemedColors } from '@/hooks/useTheme'
import { ActionAsField, ActionAsIconButton, RadiusClusterField, SelectorField } from './fields'
import type { Styles } from './styles'
import type { QuickFilterAction, Selector } from './types'

export function RowBar({
  leadingActions,
  trailingActions,
  radiusInlineActions,
  selectors,
  styles,
  colors,
}: {
  leadingActions: QuickFilterAction[]
  trailingActions: QuickFilterAction[]
  radiusInlineActions: QuickFilterAction[]
  selectors: Selector[]
  styles: Styles
  colors: ThemedColors
}) {
  return (
    <View style={styles.row} pointerEvents="box-none">
      {leadingActions.map((action) => (
        <ActionAsIconButton key={action.key} action={action} styles={styles} colors={colors} />
      ))}
      {selectors.map((selector) =>
        selector.key === 'radius' && radiusInlineActions.length > 0 ? (
          <RadiusClusterField
            key={selector.key}
            selector={selector}
            inlineActions={radiusInlineActions}
            styles={styles}
            colors={colors}
          />
        ) : (
          <SelectorField key={selector.key} selector={selector} styles={styles} colors={colors} />
        ),
      )}
      {trailingActions.map((action) => (
        <ActionAsField key={action.key} action={action} styles={styles} colors={colors} />
      ))}
    </View>
  )
}
