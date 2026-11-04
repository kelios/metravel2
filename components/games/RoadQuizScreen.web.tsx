import Feather from '@expo/vector-icons/Feather'
import { useRef, useState } from 'react'
import { StyleSheet, View, type ViewInstance } from 'react-native'

import Button from '@/components/ui/Button'
import LinkPressable from '@/components/ui/LinkPressable'
import { Body, Eyebrow, Heading } from '@/components/ui/Typography'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { formatInteger } from '@/i18n'
import { useTranslation } from '@/i18n/LocaleProvider'
import { webAccessibilityProps } from '@/utils/webProps'
import { useRoadQuiz, type QuizQuestion, type RoadQuiz } from './gamesMedia'
import { advanceQuizRound, answerQuizQuestion, initialQuizRound } from './quizRound'

const { radii, spacing, touchTarget } = DESIGN_TOKENS

function QuizRound({ questions, locale }: { questions: QuizQuestion[]; locale: 'ru' }) {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const [round, setRound] = useState(initialQuizRound)
  const questionRef = useRef<ViewInstance>(null)
  const question = questions[round.index]
  const answered = round.answer !== null
  const correct = question?.correctChoiceId === round.answer
  const progress = (round.index + Number(answered)) / questions.length

  function answer(choiceId: string) {
    if (!question) return
    questionRef.current?.focus()
    setRound(current => current.index === round.index ? answerQuizQuestion(current, question, choiceId) : current)
  }

  function next() {
    questionRef.current?.focus()
    setRound(advanceQuizRound)
  }

  function replay() {
    questionRef.current?.focus()
    setRound(initialQuizRound)
  }

  return (
    <View ref={questionRef} tabIndex={-1} style={styles.round}>
      <View aria-hidden style={[styles.progressTrack, { backgroundColor: colors.primarySoft }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.primaryDark }]} />
      </View>
      <View aria-live="polite">
        {question ? (
          <View style={styles.group}>
            <Body variant="small" color={colors.primaryText}>{t('gamesStatic:quizProgress', {
              current: formatInteger(round.index + 1), total: formatInteger(questions.length),
            })}</Body>
            <Heading level={2} lang={locale}>{question.prompt}</Heading>
          </View>
        ) : (
          <View style={[styles.result, { backgroundColor: colors.primarySoft }]}>
            <Feather name="award" size={36} color={colors.primaryDark} aria-hidden />
            <Heading level={2} align="center">{t('gamesStatic:quizFinished')}</Heading>
            <Body variant="large" align="center">{t('gamesStatic:quizScore', {
              score: formatInteger(round.score), total: formatInteger(questions.length),
            })}</Body>
          </View>
        )}
      </View>
      {question ? (
        <>
          <View {...webAccessibilityProps({ lang: locale, role: 'group' })} style={styles.group}>
            {question.choices.map(choice => (
              <Button
                key={choice.id}
                label={choice.label}
                variant={answered && choice.id === question.correctChoiceId ? 'soft' : 'outline'}
                disabled={answered}
                style={styles.choice}
                labelStyle={styles.choiceLabel}
                onPress={() => answer(choice.id)}
              />
            ))}
          </View>
          <View aria-live="polite">
            {answered && (
              <View style={[styles.feedback, { backgroundColor: correct ? colors.successSoft : colors.dangerSoft }]}>
                <View style={styles.feedbackHeading}>
                  <Feather name={correct ? 'check-circle' : 'info'} size={20}
                    color={correct ? colors.success : colors.danger} aria-hidden />
                  <Heading level={3} style={styles.feedbackTitle}>
                    {correct ? t('gamesStatic:quizCorrect') : t('gamesStatic:quizIncorrect')}
                  </Heading>
                </View>
                <Body variant="strong">
                  {t('gamesStatic:quizCorrectAnswer')}{' '}
                  <Body lang={locale} variant="strong">{question.choices.find(choice => choice.id === question.correctChoiceId)?.label}</Body>
                </Body>
                <Body lang={locale}>{question.explanation}</Body>
              </View>
            )}
          </View>
          {answered && (
            <Button
              label={round.index + 1 === questions.length ? t('gamesStatic:quizResults') : t('gamesStatic:quizNext')}
              onPress={next}
            />
          )}
        </>
      ) : (
        <Button label={t('gamesStatic:replay')} onPress={replay} />
      )}
    </View>
  )
}

function QuizSession({ quiz }: { quiz: RoadQuiz }) {
  const { t } = useTranslation()
  const { data, isError, isFetching, refetch } = useRoadQuiz(quiz)

  if (data) {
    return (
      <>
        <Heading level={1} lang={data.locale}>{data.title}</Heading>
        <QuizRound questions={data.questions} locale={data.locale} />
      </>
    )
  }

  return (
    <>
      <Heading level={1}>{t('gamesStatic:quizTitle')}</Heading>
      {isError ? (
        <>
          <Body accessibilityRole="alert">{t('gamesStatic:quizLoadError')}</Body>
          <Button label={t('gamesStatic:retry')} loading={isFetching} onPress={() => { void refetch() }} />
        </>
      ) : <Body aria-live="polite">{t('gamesStatic:quizLoading')}</Body>}
    </>
  )
}

export default function RoadQuizScreen({ quiz }: { quiz: RoadQuiz | undefined }) {
  const { t } = useTranslation()
  const colors = useThemedColors()

  return (
    <View style={styles.group}>
      <LinkPressable href="/games" style={styles.back}>
        <Feather name="arrow-left" size={18} color={colors.primaryDark} aria-hidden />
        <Body variant="strong" color={colors.primaryText} style={styles.feedbackTitle}>
          {t('gamesStatic:quizBack')}
        </Body>
      </LinkPressable>
      <View style={[styles.panel, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Eyebrow color={colors.primaryText}>{t('gamesStatic:roadTitle')}</Eyebrow>
        {quiz ? <QuizSession key={quiz.id} quiz={quiz} /> : (
          <>
            <Heading level={1}>{t('gamesStatic:quizTitle')}</Heading>
            <Body accessibilityRole="alert">{t('gamesStatic:quizLoadError')}</Body>
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  panel: { gap: spacing.sm, borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    minHeight: touchTarget.minHeight,
  },
  round: { gap: spacing.md },
  progressTrack: { height: 6, borderRadius: radii.pill, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radii.pill },
  choice: { justifyContent: 'flex-start', paddingHorizontal: spacing.md },
  choiceLabel: { textAlign: 'left' },
  feedback: { gap: spacing.xs, padding: spacing.md, borderRadius: radii.md },
  feedbackHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  feedbackTitle: { flexShrink: 1 },
  result: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: radii.lg },
})
