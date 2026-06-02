import React from 'react'
import { Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import CardActionPressable from '@/components/ui/CardActionPressable'
import type { ThemedColors } from '@/hooks/useTheme'
import type { Styles } from './styles'
import type { QuickFilterAction, Selector } from './types'

export function IconActionButton({
  action,
  styles,
  colors,
}: {
  action: QuickFilterAction
  styles: Styles
  colors: ThemedColors
}) {
  return (
    <Pressable
      accessibilityLabel={action.label}
      accessibilityRole="button"
      onPress={action.onPress}
      testID={action.testID}
      style={({ pressed }) => [styles.iconButton, pressed && styles.fieldPressed]}
    >
      <Feather name={action.icon} size={16} color={colors.primary} style={styles.iconButtonIcon} />
    </Pressable>
  )
}

export function SelectorField({
  selector,
  styles,
  colors,
}: {
  selector: Selector
  styles: Styles
  colors: ThemedColors
}) {
  return (
    <View ref={selector.ref} collapsable={false} style={styles.fieldWrap}>
      <CardActionPressable
        accessibilityLabel={`${selector.label}: ${selector.value}`}
        onPress={selector.onPress}
        title={selector.label}
        style={({ pressed }: any) => [styles.field, pressed && styles.fieldPressed]}
      >
        <Feather name={selector.icon} size={15} color={colors.primary} style={styles.fieldIcon} />
        <Text
          style={[styles.fieldLabel, selector.hideLabel && styles.fieldLabelHidden]}
          numberOfLines={1}
        >
          {selector.label}
        </Text>
        <Text style={styles.fieldValue} numberOfLines={1}>
          {selector.value}
        </Text>
        <Feather name="chevron-down" size={13} color={colors.textMuted} style={styles.fieldCaret} />
      </CardActionPressable>
    </View>
  )
}

export function RadiusClusterField({
  selector,
  inlineActions,
  styles,
  colors,
}: {
  selector: Selector
  inlineActions: QuickFilterAction[]
  styles: Styles
  colors: ThemedColors
}) {
  return (
    <View ref={selector.ref} collapsable={false} style={styles.fieldWrap}>
      <View style={styles.radiusCluster}>
        <View style={styles.radiusActionsGroup}>
          {inlineActions.map((action) => (
            <CardActionPressable
              key={action.key}
              testID={action.testID}
              accessibilityLabel={action.label}
              onPress={action.onPress}
              title={action.label}
              style={({ pressed }: any) => [
                styles.radiusActionButton,
                pressed && styles.fieldPressed,
              ]}
            >
              <Feather
                name={action.icon}
                size={15}
                color={colors.primary}
                style={styles.iconButtonIcon}
              />
            </CardActionPressable>
          ))}
        </View>
        <View style={styles.radiusDivider} />
        <View style={styles.radiusFieldWrap}>
          <CardActionPressable
            accessibilityLabel={`${selector.label}: ${selector.value}`}
            onPress={selector.onPress}
            title={selector.label}
            style={({ pressed }: any) => [styles.radiusField, pressed && styles.fieldPressed]}
          >
            <Feather
              name={selector.icon}
              size={15}
              color={colors.primary}
              style={styles.fieldIcon}
            />
            <Text
              style={[styles.fieldLabel, selector.hideLabel && styles.fieldLabelHidden]}
              numberOfLines={1}
            >
              {selector.label}
            </Text>
            <Text style={styles.fieldValue} numberOfLines={1}>
              {selector.value}
            </Text>
            <Feather
              name="chevron-down"
              size={13}
              color={colors.textMuted}
              style={styles.fieldCaret}
            />
          </CardActionPressable>
        </View>
      </View>
    </View>
  )
}

export function ActionAsField({
  action,
  styles,
  colors,
}: {
  action: QuickFilterAction
  styles: Styles
  colors: ThemedColors
}) {
  return (
    <View style={styles.actionWrap}>
      <CardActionPressable
        testID={action.testID}
        accessibilityLabel={action.label}
        onPress={action.onPress}
        title={action.label}
        style={({ pressed }: any) => [styles.field, pressed && styles.fieldPressed]}
      >
        <Feather name={action.icon} size={15} color={colors.primary} style={styles.fieldIcon} />
      </CardActionPressable>
    </View>
  )
}

export function ActionAsIconButton({
  action,
  styles,
  colors,
}: {
  action: QuickFilterAction
  styles: Styles
  colors: ThemedColors
}) {
  return (
    <View style={styles.actionWrap}>
      <CardActionPressable
        testID={action.testID}
        accessibilityLabel={action.label}
        onPress={action.onPress}
        title={action.label}
        style={({ pressed }: any) => [styles.iconButton, pressed && styles.fieldPressed]}
      >
        <Feather name={action.icon} size={15} color={colors.primary} style={styles.iconButtonIcon} />
      </CardActionPressable>
    </View>
  )
}
