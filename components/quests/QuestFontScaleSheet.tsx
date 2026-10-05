import React, { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import ActionListSheet from '@/components/ui/ActionListSheet'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { formatNumber } from '@/i18n/format'
import { useQuestFontScaleControls } from '@/stores/questFontScaleStore'
import { globalFocusStyles } from '@/styles/globalFocus'
import { webTitleProps } from '@/utils/webProps'

type StepProps = {
  icon: 'zoom-in' | 'zoom-out'
  label: string
  disabled: boolean
  onPress: () => void
  testID: string
  styles: ReturnType<typeof createStyles>
  colors: ThemedColors
}

function StepButton({ icon, label, disabled, onPress, testID, styles, colors }: StepProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[styles.step, globalFocusStyles.focusable]}
      testID={testID}
      {...webTitleProps(label)}
    >
      <Feather name={icon} size={20} color={disabled ? colors.disabled : colors.text} />
    </Pressable>
  )
}

/**
 * #2148: «Размер шрифта» из «⋯» строки экрана квеста. Лист не закрывается на
 * каждом шаге — текст задания над ним меняется сразу, и игрок видит результат.
 * Тот же лист, что у «⋯» и (i) (`ActionListSheet` с телом), шаги и границы —
 * `useQuestFontScaleControls`, как у кнопок −/+ панели на desktop.
 */
function QuestFontScaleSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { fontScale, increase, decrease, atMin, atMax } = useQuestFontScaleControls()
  const value = formatNumber(fontScale, { style: 'percent', maximumFractionDigits: 0 })

  return (
    <ActionListSheet
      visible={visible}
      onClose={onClose}
      title={i18nT('quests:components.quests.questScreenHeader.fontSize')}
    >
      <View style={styles.row} testID="quest-font-scale-sheet">
        <StepButton
          icon="zoom-out"
          label={i18nT('quests:components.quests.questWizardShell.umenshit_shrift_d50aaa89')}
          disabled={atMin}
          onPress={decrease}
          testID="quest-font-scale-decrease"
          styles={styles}
          colors={colors}
        />
        <Text
          style={styles.value}
          accessibilityLabel={i18nT('quests:components.quests.questScreenHeader.fontSizeValue', { value1: value })}
          accessibilityLiveRegion="polite"
          testID="quest-font-scale-value"
        >
          {value}
        </Text>
        <StepButton
          icon="zoom-in"
          label={i18nT('quests:components.quests.questWizardShell.uvelichit_shrift_b327d021')}
          disabled={atMax}
          onPress={increase}
          testID="quest-font-scale-increase"
          styles={styles}
          colors={colors}
        />
      </View>
    </ActionListSheet>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      paddingVertical: 8,
    },
    step: {
      width: 48,
      height: 48,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    value: {
      minWidth: 72,
      textAlign: 'center',
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
    },
  })

export default React.memo(QuestFontScaleSheet)
