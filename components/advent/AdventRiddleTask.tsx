import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, StyleSheet, Text, TextInput, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { ANIMATION_NATIVE_DRIVER, useReduceMotion } from '@/hooks/useReduceMotion'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { formatInteger } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import { useLocaleRevision } from '@/i18n/useLocaleRevision'
import type { AdventRiddleQuestion } from '@/types/advent'
import { buildAdventAnswerChecker } from '@/utils/advent/adventRiddle'
import type { AdventPaperPalette } from '@/constants/adventVisuals'
import AdventCelebration from './AdventCelebration'
import AdventSparkles from './AdventSparkles'
import { useAdventPaper } from './useAdventPaper'

type Props = {
  questions: AdventRiddleQuestion[]
  /** XP дверцы — для счётчика в финальном отклике. */
  xp?: number
  onComplete: () => void
}

/** Промежуточный «Верно!» держится не меньше 800 мс (#3482). */
export const ADVENT_STEP_CELEBRATE_MS = 900

type Status = 'idle' | 'wrong' | 'advancing' | 'solved'

/** Ответ игрока в отклике: как ввёл, с заглавной буквы. */
const displayAnswer = (answer: string) => {
  const trimmed = answer.trim()
  return trimmed ? trimmed.charAt(0).toLocaleUpperCase() + trimmed.slice(1) : trimmed
}

/**
 * Загадка или викторина: вопросы по одному, проверка чекером квестов (#2862).
 * Верный промежуточный ответ празднуется перед следующим вопросом, последний —
 * засчитывает задание и остаётся на виду с искрами и XP. Промах мягкий:
 * «Почти!» и подсказка отдельной строкой; пустой ответ не проверяется (#3482).
 */
function AdventRiddleTask({ questions, xp, onComplete }: Props) {
  const colors = useThemedColors()
  const paper = useAdventPaper()
  const styles = useMemo(() => createStyles(colors, paper), [colors, paper])
  const reduceMotion = useReduceMotion()
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [wrongOption, setWrongOption] = useState<string | null>(null)
  const [solvedAnswer, setSolvedAnswer] = useState('')
  const question = questions[index]
  const checker = useMemo(() => (question ? buildAdventAnswerChecker(question.answer_pattern) : null), [question])
  const locale = useLocaleRevision()
  const shake = useRef(new Animated.Value(0)).current
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
  }, [])

  const nudge = useCallback(() => {
    if (reduceMotion) return
    shake.setValue(0)
    Animated.sequence(
      [6, -6, 4, -3, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 60, useNativeDriver: ANIMATION_NATIVE_DRIVER })),
    ).start()
  }, [reduceMotion, shake])

  const locked = status === 'advancing' || status === 'solved'

  const submit = useCallback(
    (answer: string) => {
      if (!checker || locked || !answer.trim()) return
      if (!checker(answer, locale)) {
        setStatus('wrong')
        setWrongOption(question?.options?.length ? answer : null)
        nudge()
        return
      }
      setWrongOption(null)
      if (index + 1 >= questions.length) {
        setSolvedAnswer(displayAnswer(answer))
        setStatus('solved')
        onComplete()
        return
      }
      setStatus('advancing')
      advanceTimer.current = setTimeout(() => {
        advanceTimer.current = null
        setIndex((value) => value + 1)
        setInput('')
        setStatus('idle')
      }, ADVENT_STEP_CELEBRATE_MS)
    },
    [checker, locked, locale, question, index, questions.length, onComplete, nudge],
  )

  if (!question) return null

  if (status === 'solved') {
    return (
      <View style={styles.wrap} testID="advent-riddle">
        <AdventCelebration
          testID="advent-riddle-correct"
          text={i18nT('adventStatic:riddle.solved', { value1: solvedAnswer })}
          xp={xp}
        />
      </View>
    )
  }

  const canCheck = input.trim().length > 0 && !locked

  return (
    <View style={styles.wrap} testID="advent-riddle">
      {questions.length > 1 ? (
        <Text style={styles.step}>
          {i18nT('adventStatic:riddle.step', { value1: formatInteger(index + 1), value2: formatInteger(questions.length) })}
        </Text>
      ) : null}
      <Text style={styles.question}>{question.question}</Text>
      <Animated.View style={{ transform: [{ translateX: shake }] }}>
        {question.options?.length ? (
          <View style={styles.options}>
            {question.options.map((option) => (
              <Button
                key={option}
                label={option}
                variant="outline"
                size="sm"
                disabled={locked}
                style={wrongOption === option ? styles.optionWrong : undefined}
                icon={wrongOption === option ? <Feather name="x" size={14} color={paper.gold} /> : undefined}
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
              editable={!locked}
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
            <Button
              label={i18nT('adventStatic:riddle.check')}
              onPress={() => submit(input)}
              disabled={!canCheck}
              style={styles.check}
              testID="advent-riddle-check"
            />
          </View>
        )}
      </Animated.View>
      {status === 'wrong' ? (
        <View style={styles.wrong} accessibilityLiveRegion="polite" testID="advent-riddle-wrong">
          <Text style={styles.wrongText}>
            {i18nT(wrongOption ? 'adventStatic:riddle.optionWrong' : 'adventStatic:riddle.wrong')}
          </Text>
          {question.hint ? (
            <Text style={styles.hint} testID="advent-riddle-hint">
              {i18nT('adventStatic:riddle.hint', { value1: question.hint })}
            </Text>
          ) : null}
        </View>
      ) : null}
      {status === 'advancing' ? (
        <View style={styles.advancing} accessibilityLiveRegion="polite" testID="advent-riddle-step-correct">
          <AdventSparkles burstKey={index} count={8} radius={40} color={paper.gold} />
          <Feather name="check-circle" size={18} color={paper.success} />
          <Text style={styles.advancingText}>{i18nT('adventStatic:riddle.correct')}</Text>
        </View>
      ) : null}
    </View>
  )
}

const createStyles = (colors: ThemedColors, paper: AdventPaperPalette) =>
  StyleSheet.create({
    wrap: { gap: DESIGN_TOKENS.spacing.sm },
    step: { fontSize: 12, color: paper.inkMuted, fontWeight: '600' },
    question: { fontSize: 15, lineHeight: 22, color: paper.ink },
    options: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.xs },
    optionWrong: { borderColor: paper.gold },
    inputRow: { flexDirection: 'row', gap: DESIGN_TOKENS.spacing.xs, alignItems: 'center', width: '100%' },
    // B1 (#3482): без `minWidth: 0` поле не сжимается и выталкивает кнопку за край блока.
    input: {
      flex: 1,
      minWidth: 0,
      minHeight: 44,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: DESIGN_TOKENS.radii.sm,
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      color: colors.text,
      backgroundColor: colors.background,
      fontSize: 15,
    },
    check: { flexShrink: 0 },
    wrong: { gap: 2 },
    wrongText: { fontSize: 14, lineHeight: 20, color: paper.gold, fontWeight: '700' },
    hint: { fontSize: 14, lineHeight: 20, color: paper.inkMuted },
    advancing: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xs, position: 'relative' },
    advancingText: { fontSize: 15, lineHeight: 21, color: paper.success, fontWeight: '700' },
  })

export default memo(AdventRiddleTask)
