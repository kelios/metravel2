import { memo, useCallback, useMemo, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'

import Button from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { formatInteger } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import type { AdventRiddleQuestion } from '@/types/advent'
import { buildAdventAnswerChecker } from '@/utils/advent/adventRiddle'

type Props = {
  questions: AdventRiddleQuestion[]
  onComplete: () => void
}

/**
 * Загадка или викторина: вопросы идут по одному, ответ проверяется чекером
 * квестов (#2862); последний верный ответ засчитывает задание.
 */
function AdventRiddleTask({ questions, onComplete }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'wrong' | 'correct'>('idle')
  const question = questions[index]
  const checker = useMemo(() => (question ? buildAdventAnswerChecker(question.answer_pattern) : null), [question])

  const submit = useCallback(
    (answer: string) => {
      if (!checker) return
      if (!checker(answer)) {
        setStatus('wrong')
        return
      }
      setStatus('correct')
      if (index + 1 >= questions.length) {
        onComplete()
        return
      }
      setIndex(index + 1)
      setInput('')
      setStatus('idle')
    },
    [checker, index, questions.length, onComplete],
  )

  if (!question) return null

  return (
    <View style={styles.wrap} testID="advent-riddle">
      {questions.length > 1 ? (
        <Text style={styles.step}>
          {i18nT('adventStatic:riddle.step', { value1: formatInteger(index + 1), value2: formatInteger(questions.length) })}
        </Text>
      ) : null}
      <Text style={styles.question}>{question.question}</Text>
      {question.options?.length ? (
        <View style={styles.options}>
          {question.options.map((option) => (
            <Button
              key={option}
              label={option}
              variant="outline"
              size="sm"
              testID={`advent-riddle-option-${option}`}
              onPress={() => submit(option)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.inputRow}>
          <TextInput
            testID="advent-riddle-input"
            value={input}
            onChangeText={(value) => {
              setInput(value)
              if (status === 'wrong') setStatus('idle')
            }}
            onSubmitEditing={() => submit(input)}
            placeholder={i18nT('adventStatic:riddle.placeholder')}
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            accessibilityLabel={i18nT('adventStatic:riddle.placeholder')}
          />
          <Button label={i18nT('adventStatic:riddle.check')} onPress={() => submit(input)} testID="advent-riddle-check" />
        </View>
      )}
      {status === 'wrong' ? (
        <Text style={styles.wrong} accessibilityLiveRegion="polite" testID="advent-riddle-wrong">
          {i18nT('adventStatic:riddle.wrong')}
          {question.hint ? ` ${i18nT('adventStatic:riddle.hint', { value1: question.hint })}` : ''}
        </Text>
      ) : null}
      {status === 'correct' ? (
        <Text style={styles.correct} accessibilityLiveRegion="polite" testID="advent-riddle-correct">
          {i18nT('adventStatic:riddle.correct')}
        </Text>
      ) : null}
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: DESIGN_TOKENS.spacing.sm },
    step: { fontSize: 12, color: colors.textMuted },
    question: { fontSize: 15, lineHeight: 22, color: colors.text },
    options: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.xs },
    inputRow: { flexDirection: 'row', gap: DESIGN_TOKENS.spacing.xs, alignItems: 'center' },
    input: {
      flex: 1,
      minHeight: 44,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: DESIGN_TOKENS.radii.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      color: colors.text,
      backgroundColor: colors.background,
      fontSize: 15,
    },
    wrong: { fontSize: 14, lineHeight: 20, color: colors.danger },
    correct: { fontSize: 14, lineHeight: 20, color: colors.success, fontWeight: '600' },
  })

export default memo(AdventRiddleTask)
