import Feather from '@expo/vector-icons/Feather'
import { Link } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { Body, Eyebrow, Heading } from '@/components/ui/Typography'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useTranslation } from '@/i18n/LocaleProvider'
import type { RoadQuiz } from './gamesMedia'

const { radii, spacing } = DESIGN_TOKENS
const topicIcons = { belarus: 'map-pin', poland: 'map', world: 'globe' } as const

export default function RoadQuizSection({ quizzes }: { quizzes: RoadQuiz[] }) {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const topicNames = {
    belarus: t('gamesStatic:quizBelarus'),
    poland: t('gamesStatic:quizPoland'),
    world: t('gamesStatic:quizWorld'),
  }

  return (
    <View style={styles.section}>
      <View style={styles.group}>
        <Eyebrow color={colors.primaryText}>{t('gamesStatic:roadTitle')}</Eyebrow>
        <Heading level={2}>{t('gamesStatic:quizTitle')}</Heading>
      </View>
      {quizzes.length > 0 ? (
        <>
          <Body muted>{t('gamesStatic:quizNote')}</Body>
          <View style={styles.topics}>
            {quizzes.map(quiz => (
              <Link
                key={quiz.id}
                href={`/games?quiz=${quiz.id}`}
                target="_blank"
                rel="noopener"
                asChild
              >
                <a aria-describedby="games-quiz-new-tab" style={topicLinkStyle}>
                  <View style={[styles.topic, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                    <View aria-hidden style={[styles.stamp, { backgroundColor: colors.primarySoft }]}>
                      <Feather name={topicIcons[quiz.id]} size={22} color={colors.primaryDark} />
                    </View>
                    <Body variant="strong" style={styles.topicName}>{topicNames[quiz.id]}</Body>
                    <Feather name="arrow-up-right" size={18} color={colors.primaryDark} aria-hidden />
                  </View>
                </a>
              </Link>
            ))}
          </View>
          <Body nativeID="games-quiz-new-tab" variant="small" muted>{t('gamesStatic:quizNewTab')}</Body>
        </>
      ) : <Body muted>{t('gamesStatic:roadEmpty')}</Body>}
    </View>
  )
}

const topicLinkStyle = {
  display: 'flex',
  flex: '1 1 210px',
  minWidth: 0,
  borderRadius: radii.lg,
  textDecoration: 'none',
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  group: { gap: spacing.xs },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  topic: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  stamp: { width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  topicName: { flex: 1, minWidth: 0 },
})
