import React, { useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import ActionListSheet, { type ActionListSheetItem } from '@/components/ui/ActionListSheet'
import InfoSheet from '@/components/ui/InfoSheet'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { globalFocusStyles } from '@/styles/globalFocus'
import { translate as i18nT } from '@/i18n'
import { webTitleRef } from '@/utils/webProps'

import type { ScreenHeaderConfig } from './ScreenHeaderContext'

type IconButtonProps = {
  icon: keyof typeof Feather.glyphMap
  label: string
  onPress: () => void
  disabled?: boolean
  testID?: string
  styles: ReturnType<typeof createStyles>
  color: string
}

function BarIconButton({ icon, label, onPress, disabled, testID, styles, color }: IconButtonProps) {
  return (
    <Pressable
      ref={webTitleRef(label)}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={disabled ? { disabled: true } : undefined}
      style={[styles.button, globalFocusStyles.focusable]}
      testID={testID}
    >
      <Feather name={icon} size={20} color={color} />
    </Pressable>
  )
}

/**
 * Правая часть строки вложенного экрана на телефоне (#2099): (i) с листом
 * пояснения, главное действие и «⋯». Каждая иконка 44×44 с подписью и title.
 */
export default function ScreenHeaderBarActions({ header }: { header: ScreenHeaderConfig }) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [infoOpen, setInfoOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const overflow = useMemo<ActionListSheetItem[]>(
    () => [
      // Пункт листа без состояния «недоступен»: недоступное действие в «⋯» не
      // показывается вовсе (мёртвая строка меню запрещена, RULES → Component reuse).
      ...(header.actions ?? []).filter((a) => !a.disabled).map((a, i) => ({
        key: `action-${i}`,
        label: a.label,
        icon: a.icon,
        onPress: a.onPress,
      })),
      ...(header.overflow ?? []),
    ],
    [header.actions, header.overflow],
  )
  const infoLabel = i18nT('common:screenHeader.info')
  const moreLabel = i18nT('common:screenHeader.more')

  return (
    <>
      <View style={styles.row}>
        {header.info?.length ? (
          <BarIconButton
            icon="info"
            label={infoLabel}
            onPress={() => setInfoOpen(true)}
            testID="screen-header-info"
            styles={styles}
            color={colors.textMuted}
          />
        ) : null}
        {header.primaryAction ? (
          <BarIconButton
            icon={header.primaryAction.icon}
            label={header.primaryAction.label}
            onPress={header.primaryAction.onPress}
            disabled={header.primaryAction.disabled}
            testID={header.primaryAction.testID ?? 'screen-header-primary'}
            styles={styles}
            color={header.primaryAction.disabled ? colors.textMuted : colors.primaryDark}
          />
        ) : null}
        {overflow.length ? (
          <BarIconButton
            icon="more-horizontal"
            label={moreLabel}
            onPress={() => setMoreOpen(true)}
            testID="screen-header-more"
            styles={styles}
            color={colors.textMuted}
          />
        ) : null}
      </View>
      {header.info?.length ? (
        <InfoSheet visible={infoOpen} onClose={() => setInfoOpen(false)} title={header.title} paragraphs={header.info} />
      ) : null}
      {overflow.length ? (
        <ActionListSheet visible={moreOpen} onClose={() => setMoreOpen(false)} title={header.title} actions={overflow} />
      ) : null}
    </>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xxs },
    button: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
  })
