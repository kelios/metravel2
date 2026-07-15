import React, { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useThemedColors } from '@/hooks/useTheme'
import { selectPlural, translate as i18nT } from '@/i18n'


type Colors = ReturnType<typeof useThemedColors>

interface QuestGuestGateProps {
  /** Сколько точек гость уже прошёл — показываем в тексте «сохраним прогресс». */
  passedCount: number
  onLogin: () => void
  onRegister: () => void
  /** Мягкий гейт: гость может закрыть и вернуться к пройденным точкам. */
  onDismiss: () => void
  testID?: string
}

/**
 * Мягкий гейт после N бесплатных точек гостя. Не форсит закрытие квеста:
 * «Сохраним прогресс — войди или зарегистрируйся». Кнопки ведут на /login
 * и /registration с redirect обратно на текущий квест.
 */
export default function QuestGuestGate({
  passedCount,
  onLogin,
  onRegister,
  onDismiss,
  testID,
}: QuestGuestGateProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.title}>{i18nT('quests:components.quests.QuestGuestGate.sohranim_tvoy_progress_b99df14f')}</Text>
      <Text style={styles.lead}>
        {i18nT('quests:components.quests.QuestGuestGate.ty_proshel_ca229b47')}{passedCount} {pluralPoints(passedCount)} {i18nT('quests:components.quests.QuestGuestGate.zdorovo_chtoby_prodolzhit_kvest_sohranit_rez_1b7311fc')}</Text>

      <Pressable
        onPress={onLogin}
        style={styles.primaryButton}
        testID="quest-guest-gate-login"
        accessibilityRole="button"
        accessibilityLabel={i18nT('quests:components.quests.QuestGuestGate.voyti_chtoby_sohranit_progress_kvesta_a58fb69a')}
      >
        <Text style={styles.primaryButtonText}>{i18nT('quests:components.quests.QuestGuestGate.voyti_5f893cd8')}</Text>
      </Pressable>

      <Pressable
        onPress={onRegister}
        style={styles.secondaryButton}
        testID="quest-guest-gate-register"
        accessibilityRole="button"
        accessibilityLabel={i18nT('quests:components.quests.QuestGuestGate.zaregistrirovatsya_chtoby_sohranit_progress__5164906b')}
      >
        <Text style={styles.secondaryButtonText}>{i18nT('quests:components.quests.QuestGuestGate.zaregistrirovatsya_84006714')}</Text>
      </Pressable>

      <Pressable
        onPress={onDismiss}
        style={styles.dismissButton}
        testID="quest-guest-gate-dismiss"
        accessibilityRole="button"
        accessibilityLabel={i18nT('quests:components.quests.QuestGuestGate.vernutsya_k_proydennym_tochkam_kvesta_8320b119')}
      >
        <Text style={styles.dismissButtonText}>{i18nT('quests:components.quests.QuestGuestGate.vernutsya_k_proydennym_tochkam_ac57c14e')}</Text>
      </Pressable>
    </View>
  )
}

const pluralPoints = (count: number): string => {
  return selectPlural(count, {
    one: i18nT('quests:components.quests.QuestGuestGate.tochku_6dcdfa1f'),
    few: i18nT('quests:components.quests.QuestGuestGate.tochki_13f25999'),
    many: i18nT('quests:components.quests.QuestGuestGate.tochek_9ebfcb56'),
    other: i18nT('quests:components.quests.QuestGuestGate.tochek_9ebfcb56'),
  })
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      gap: 12,
      margin: 16,
      padding: 20,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      maxWidth: 560,
      width: '100%',
      alignSelf: 'center',
    },
    title: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
    },
    lead: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
    },
    primaryButton: {
      marginTop: 4,
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    primaryButtonText: {
      color: colors.textOnPrimary,
      fontWeight: '800',
      fontSize: 15,
    },
    secondaryButton: {
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    secondaryButtonText: {
      color: colors.primaryText,
      fontWeight: '800',
      fontSize: 15,
    },
    dismissButton: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    dismissButtonText: {
      color: colors.textMuted,
      fontWeight: '600',
      fontSize: 13,
    },
  })
