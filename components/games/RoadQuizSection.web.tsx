import { useRef, useState } from 'react'
import { StyleSheet, View, type ViewInstance } from 'react-native'

import Button from '@/components/ui/Button'
import { Body, Heading } from '@/components/ui/Typography'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { formatInteger } from '@/i18n'
import { useTranslation } from '@/i18n/LocaleProvider'
import { webAccessibilityProps } from '@/utils/webProps'
import { useRoadQuiz, type QuizQuestion, type RoadQuiz } from './gamesMedia'
import { advanceQuizRound, answerQuizQuestion, initialQuizRound } from './quizRound'

const { radii, spacing } = DESIGN_TOKENS

function QuizRound({ questions, locale, onBack }: {
  questions: QuizQuestion[]
  locale: 'ru'
  onBack: () => void
}) {
  const { t } = useTranslation()
  const [round, setRound] = useState(initialQuizRound)
  const questionRef = useRef<ViewInstance>(null)
  const question = questions[round.index]

  function answer(choiceId: string) {
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
    <View ref={questionRef} tabIndex={-1} style={styles.group}>
      {question ? (
        <>
          <View aria-live="polite" style={styles.group}>
            <Body variant="small" muted>{t('gamesStatic:quizProgress', {
              current: formatInteger(round.index + 1), total: formatInteger(questions.length),
            })}</Body>
            <Heading level={4} lang={locale}>{question.prompt}</Heading>
          </View>
          <View {...webAccessibilityProps({ lang: locale, role: 'group' })} style={styles.group}>
            {question.choices.map(choice => (
              <Button key={choice.id} label={choice.label} variant="outline" disabled={round.answer !== null}
                onPress={() => answer(choice.id)} />
            ))}
          </View>
          <View aria-live="polite" style={styles.group}>
            {round.answer !== null && (
              <>
                <Heading level={4}>
                  {round.answer === question.correctChoiceId ? t('gamesStatic:quizCorrect') : t('gamesStatic:quizIncorrect')}
                </Heading>
                <Body>
                  {t('gamesStatic:quizCorrectAnswer')}{' '}
                  <Body lang={locale}>{question.choices.find(choice => choice.id === question.correctChoiceId)?.label}</Body>
                </Body>
                <Body lang={locale}>{question.explanation}</Body>
              </>
            )}
          </View>
        </>
      ) : (
        <View aria-live="polite" style={styles.group}>
          <Heading level={4}>{t('gamesStatic:quizFinished')}</Heading>
          <Body>{t('gamesStatic:quizScore', {
            score: formatInteger(round.score), total: formatInteger(questions.length),
          })}</Body>
        </View>
      )}
      <View style={styles.actions}>
        {question && round.answer !== null && (
          <Button label={round.index + 1 === questions.length ? t('gamesStatic:quizResults') : t('gamesStatic:quizNext')}
            onPress={next} />
        )}
        {!question && <Button label={t('gamesStatic:replay')} onPress={replay} />}
        <Button label={t('gamesStatic:quizBack')} variant="outline" onPress={onBack} />
      </View>
    </View>
  )
}

function QuizSession({ quiz, onBack }: { quiz: RoadQuiz; onBack: () => void }) {
  const { t } = useTranslation()
  const { data, isError, isFetching, refetch } = useRoadQuiz(quiz)

  if (data) {
    return (
      <>
        <Heading level={3} lang={data.locale}>{data.title}</Heading>
        <QuizRound questions={data.questions} locale={data.locale} onBack={onBack} />
      </>
    )
  }

  return (
    <>
      {isError
        ? <Body accessibilityRole="alert">{t('gamesStatic:quizLoadError')}</Body>
        : <Body aria-live="polite">{t('gamesStatic:quizLoading')}</Body>}
      <View style={styles.actions}>
        {isError && <Button label={t('gamesStatic:retry')} loading={isFetching} onPress={() => { void refetch() }} />}
        <Button label={t('gamesStatic:quizBack')} variant="outline" onPress={onBack} />
      </View>
    </>
  )
}

export default function RoadQuizSection({ quizzes }: { quizzes: RoadQuiz[] }) {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const [selected, setSelected] = useState<RoadQuiz | null>(null)
  const sectionRef = useRef<ViewInstance>(null)
  const topicNames = {
    belarus: t('gamesStatic:quizBelarus'),
    poland: t('gamesStatic:quizPoland'),
    world: t('gamesStatic:quizWorld'),
  }

  function choose(quiz: RoadQuiz | null) {
    sectionRef.current?.focus()
    setSelected(quiz)
  }

  return (
    <View ref={sectionRef} tabIndex={-1} style={styles.group}>
      <Heading level={2}>{t('gamesStatic:roadTitle')}</Heading>
      {selected ? (
        <View style={[styles.panel, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <QuizSession quiz={selected} onBack={() => choose(null)} />
        </View>
      ) : quizzes.length > 0 ? (
        <>
          <Body muted>{t('gamesStatic:quizNote')}</Body>
          <View style={styles.actions}>
            {quizzes.map(quiz => (
              <Button key={quiz.id} label={topicNames[quiz.id]} variant="outline" onPress={() => choose(quiz)} />
            ))}
          </View>
        </>
      ) : <Body muted>{t('gamesStatic:roadEmpty')}</Body>}
    </View>
  )
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  panel: { gap: spacing.sm, borderRadius: radii.lg, borderWidth: 1, padding: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
})
