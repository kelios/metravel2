import { memo, useCallback } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useRouter } from 'expo-router'

import type { AiSource } from '@/api/aiAssist/types'
import UIButton from '@/components/ui/Button'
import type { ThemedColors } from '@/hooks/useTheme'
import { AI_OFFTOPIC_STRIKES_TO_BLOCK } from '@/api/aiAssist/limits'
import { translate as i18nT } from '@/i18n'

import { AssistantAnswerText } from './AssistantAnswerText'
import type { AssistantStyles } from './assistantStyles'
import type { AssistantTurn } from './useAssistantChat'

type SourceRowProps = {
  source: AiSource
  styles: AssistantStyles
  colors: ThemedColors
}

const SourceRow = memo(function SourceRow({ source, styles, colors }: SourceRowProps) {
  const router = useRouter()
  const onPress = useCallback(() => {
    router.push(source.path as never)
  }, [router, source.path])
  const typeLabel = source.type === 'quest' ? i18nT('aiAssistStatic:ask.sourceQuest') : i18nT('aiAssistStatic:ask.sourceTravel')
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${typeLabel}: ${source.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.sourceRow, pressed && styles.sourceRowPressed]}
      testID={`assistant-source-${source.type}-${source.source_id}`}
    >
      <View style={styles.sourceIcon}>
        <Feather name={source.type === 'quest' ? 'flag' : 'file-text'} size={16} color={colors.primaryDark} />
      </View>
      <View style={styles.sourceTextCol}>
        <Text style={styles.sourceType}>{typeLabel}</Text>
        <Text style={styles.sourceTitle} numberOfLines={2}>
          {source.title}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  )
})

type AssistantTurnCardProps = {
  turn: AssistantTurn
  styles: AssistantStyles
  colors: ThemedColors
  busy: boolean
  onRetry: (turnId: string) => void
  onOpenCatalog: () => void
}

function AssistantTurnCardComponent({ turn, styles, colors, busy, onRetry, onOpenCatalog }: AssistantTurnCardProps) {
  const retry = useCallback(() => onRetry(turn.id), [onRetry, turn.id])
  const isWorking = turn.status === 'searching' || turn.status === 'streaming'
  const showSources = turn.sources.length > 0 && turn.status !== 'searching'

  let notice: string | null = null
  let noticeAction: 'retry' | 'catalog' | null = null
  switch (turn.status) {
    case 'no_sources':
      notice = i18nT('aiAssistStatic:ask.noSources')
      noticeAction = 'catalog'
      break
    case 'off_topic':
      notice =
        (turn.offTopicStrikes ?? 0) >= AI_OFFTOPIC_STRIKES_TO_BLOCK
          ? i18nT('aiAssistStatic:ask.offTopicBlocked')
          : i18nT('aiAssistStatic:ask.offTopicWarning', { count: turn.offTopicStrikes ?? 1, max: AI_OFFTOPIC_STRIKES_TO_BLOCK })
      break
    case 'unavailable':
    case 'error':
      notice = i18nT('aiAssistStatic:ask.unavailable')
      noticeAction = 'retry'
      break
    case 'busy':
      notice = i18nT('aiAssistStatic:ask.busy')
      noticeAction = 'retry'
      break
    case 'aborted':
      // Иначе остановленный вопрос оставался бы пустой карточкой без подписи и
      // без способа повторить.
      notice = i18nT('aiAssistStatic:ask.stopped')
      noticeAction = 'retry'
      break
    case 'done':
      if (!turn.answer.trim()) {
        notice = i18nT('aiAssistStatic:ask.emptyAnswer')
        noticeAction = 'retry'
      }
      break
    default:
      break
  }

  return (
    <View style={styles.turn} testID={`assistant-turn-${turn.status}`}>
      <View style={styles.questionBubble}>
        <Text style={styles.roleLabel}>{i18nT('aiAssistStatic:ask.you')}</Text>
        <Text style={styles.questionText}>{turn.question}</Text>
      </View>

      <View style={styles.answerCard}>
        <Text style={styles.roleLabel}>{i18nT('aiAssistStatic:ask.assistant')}</Text>

        {turn.status === 'off_topic' ? (
          <Text style={styles.answerText} testID="assistant-offtopic">
            {i18nT('aiAssistStatic:ask.offTopic')}
          </Text>
        ) : null}

        {turn.answer ? (
          <AssistantAnswerText
            text={turn.answer}
            sources={turn.sources}
            style={styles.answerText}
            linkColor={colors.primaryDark}
            testID="assistant-answer-text"
          />
        ) : null}

        {isWorking ? (
          <View style={styles.statusRow} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.statusText}>
              {turn.status === 'searching' ? i18nT('aiAssistStatic:ask.searching') : i18nT('aiAssistStatic:ask.writing')}
            </Text>
          </View>
        ) : null}

        {notice ? (
          <>
            <Text style={styles.noticeText}>{notice}</Text>
            <View style={styles.noticeActions}>
              {noticeAction === 'retry' ? (
                <UIButton
                  variant="soft"
                  size="sm"
                  label={i18nT('aiAssistStatic:ask.retry')}
                  onPress={retry}
                  disabled={busy}
                  testID="assistant-retry"
                />
              ) : null}
              {noticeAction === 'catalog' ? (
                <UIButton
                  variant="soft"
                  size="sm"
                  label={i18nT('aiAssistStatic:ask.openCatalog')}
                  onPress={onOpenCatalog}
                  testID="assistant-open-catalog"
                />
              ) : null}
            </View>
          </>
        ) : null}

        {turn.status === 'done' && turn.removedLinks > 0 ? (
          <Text style={styles.noticeText} testID="assistant-links-removed">
            {i18nT('aiAssistStatic:ask.linksRemoved')}
          </Text>
        ) : null}

        {showSources ? (
          <>
            <Text style={styles.sourcesTitle}>{i18nT('aiAssistStatic:ask.sourcesTitle')}</Text>
            {turn.sources.map((source) => (
              <SourceRow key={`${source.type}-${source.source_id}`} source={source} styles={styles} colors={colors} />
            ))}
          </>
        ) : null}
      </View>
    </View>
  )
}

export const AssistantTurnCard = memo(AssistantTurnCardComponent)
