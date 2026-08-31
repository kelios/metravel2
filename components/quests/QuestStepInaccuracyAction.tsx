// components/quests/QuestStepInaccuracyAction.tsx
// Структурная отметка «точка изменилась» прямо на точке маршрута (#1579).
//
// Отличается от свободнотекстовой формы `QuestInaccuracyReportModal` (#1480)
// назначением, и подписи обязаны это назначение различать: здесь один тап
// говорит «этот объект не соответствует описанию», там — произвольное
// сообщение редакции обо всём остальном. Форма не изменена.
//
// Отметка не часть прохождения: её отказ ничего не меняет в состоянии шага.

import { memo, useCallback, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { reportQuestStepInaccuracy } from '@/api/questStepInaccuracy'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { translate as i18nT } from '@/i18n'

type Props = {
  /** Числовой PK шага: эндпоинт адресуется по нему, а не по строковому `step_id`. */
  stepNumericId: number
  testID?: string
}

type Outcome = 'idle' | 'sending' | 'created' | 'already' | 'failed'

/** Минимальная цель нажатия проекта (`scripts/guard-touch-targets.js`). */
const MIN_TOUCH = 44

function QuestStepInaccuracyAction({
  stepNumericId,
  testID = 'quest-step-inaccuracy',
}: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { isAuthenticated, authReady, requireAuth } = useRequireAuth({ intent: 'report' })
  const [outcome, setOutcome] = useState<Outcome>('idle')

  const handlePress = useCallback(async () => {
    // Автор отметки берётся из авторизации (`IsAuthenticated`), поэтому гостя
    // отправляем ровно в тот же вход, что и остальные действия квеста.
    if (!isAuthenticated) {
      requireAuth()
      return
    }
    if (outcome === 'sending' || outcome === 'created' || outcome === 'already') return

    setOutcome('sending')
    try {
      const result = await reportQuestStepInaccuracy(stepNumericId)
      // Идемпотентность видна игроку: повтор — не вторая отметка, и второе
      // «спасибо» заставило бы думать, что сигнал не учитывается.
      setOutcome(result.created ? 'created' : 'already')
    } catch {
      setOutcome('failed')
    }
  }, [isAuthenticated, outcome, requireAuth, stepNumericId])

  const isResolved = outcome === 'created' || outcome === 'already'

  const message = (() => {
    switch (outcome) {
      case 'created':
        return i18nT('quests:components.quests.questWizardStepCard.inaccuracy.sent')
      case 'already':
        return i18nT('quests:components.quests.questWizardStepCard.inaccuracy.already')
      case 'failed':
        return i18nT('quests:components.quests.questWizardStepCard.inaccuracy.failed')
      default:
        return null
    }
  })()

  return (
    <View style={styles.container} testID={testID}>
      {!isResolved && (
        <Pressable
          onPress={handlePress}
          disabled={!authReady || outcome === 'sending'}
          style={styles.button}
          accessibilityRole="button"
          accessibilityState={{ disabled: !authReady || outcome === 'sending', busy: outcome === 'sending' }}
          accessibilityHint={i18nT('quests:components.quests.questWizardStepCard.inaccuracy.hint')}
          accessibilityLabel={i18nT('quests:components.quests.questWizardStepCard.inaccuracy.action')}
          testID={`${testID}-button`}
        >
          <Feather name="alert-triangle" size={14} color={colors.textMuted} />
          <Text style={styles.buttonText}>
            {outcome === 'sending'
              ? i18nT('quests:components.quests.questWizardStepCard.inaccuracy.sending')
              : i18nT('quests:components.quests.questWizardStepCard.inaccuracy.action')}
          </Text>
        </Pressable>
      )}

      {/* Исход объявляется текстом, а не только сменой цвета кнопки. */}
      {!!message && (
        <Text
          style={[styles.message, outcome === 'failed' && styles.messageFailed]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID={`${testID}-message`}
        >
          {message}
        </Text>
      )}
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      gap: 4,
      marginTop: 8,
    },
    button: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: MIN_TOUCH,
      paddingHorizontal: 10,
      borderRadius: DESIGN_TOKENS.radii.sm,
    },
    buttonText: {
      fontSize: 13,
      color: colors.textMuted,
      textDecorationLine: 'underline',
    },
    message: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.textMuted,
    },
    messageFailed: {
      color: colors.danger,
    },
  })

export default memo(QuestStepInaccuracyAction)
