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
  // Справка о сайте (#3293) — третий вид источника: запись корпуса, ведёт на страницу сайта, а не на материал.
  const typeLabel =
    source.type === 'quest' ? i18nT('aiAssistStatic:ask.sourceQuest') : source.type === 'help' ? i18nT('aiAssistStatic:ask.sourceHelp') : i18nT('aiAssistStatic:ask.sourceTravel')
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${typeLabel}: ${source.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.sourceRow, pressed && styles.sourceRowPressed]}
      testID={`assistant-source-${source.type}-${source.source_id}`}
    >
      <View style={styles.sourceIcon}>
        <Feather name={source.type === 'quest' ? 'flag' : source.type === 'help' ? 'help-circle' : 'file-text'} size={16} color={colors.primaryDark} />
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
  // Группа «Ещё по теме»: в режиме страницы (#3290) — соседние материалы; в общем подборе (#3289) —
  // карточки, не прошедшие отбор по месту и условиям вопроса. Модель их не видела.
  const mainSources = turn.sources.filter((source) => source.group !== 'nearby')
  const nearbySources = turn.sources.filter((source) => source.group === 'nearby')
  // Пустой ответ модели (#3291): вместо повтора вопроса — честная фраза; источники остаются ниже.
  // Пустая подсказка (#3345): модель не вызывалась — «на сайте пока нет материалов», найденное рядом ниже.
  const noMaterial = turn.status === 'done' && turn.fallback === true && turn.noMaterial === true
  const answerText =
    turn.status === 'done' && turn.fallback ? (noMaterial ? i18nT('aiAssistStatic:ask.noSources') : i18nT('aiAssistStatic:ask.fallbackAnswer')) : turn.answer

  let notice: string | null = null
  let noticeAction: 'retry' | 'catalog' | null = null
  switch (turn.status) {
    case 'no_sources':
      notice = i18nT('aiAssistStatic:ask.noSources')
      noticeAction = 'catalog'
      break
    case 'off_topic':
      // Отказ модели (второй рубеж) счётчиком не идёт — без предупреждения.
      if (turn.offTopicStrikes === null) break
      notice =
        turn.offTopicStrikes >= AI_OFFTOPIC_STRIKES_TO_BLOCK
          ? i18nT('aiAssistStatic:ask.offTopicBlocked')
          : i18nT('aiAssistStatic:ask.offTopicWarning', { count: turn.offTopicStrikes, max: AI_OFFTOPIC_STRIKES_TO_BLOCK })
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
      // Запасной ответ стража (#3291) — не сбой модели: повтор не предлагается.
      if (!turn.answer.trim() && !turn.fallback) {
        notice = i18nT('aiAssistStatic:ask.emptyAnswer')
        noticeAction = 'retry'
      }
      // «Материала нет» зовёт в каталог — кнопка та же, что у хода без источников.
      if (noMaterial) noticeAction = 'catalog'
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

        {answerText ? (
          <AssistantAnswerText
            text={answerText}
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

        {notice || noticeAction ? (
          <>
            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
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

        {showSources && mainSources.length > 0 ? (
          <>
            <Text style={styles.sourcesTitle}>{i18nT('aiAssistStatic:ask.sourcesTitle')}</Text>
            {mainSources.map((source) => (
              <SourceRow key={`${source.type}-${source.source_id}`} source={source} styles={styles} colors={colors} />
            ))}
          </>
        ) : null}

        {showSources && nearbySources.length > 0 ? (
          <>
            <Text style={styles.sourcesTitle} testID="assistant-sources-nearby">
              {i18nT('aiAssistStatic:ask.nearbyTitle')}
            </Text>
            {nearbySources.map((source) => (
              <SourceRow key={`${source.type}-${source.source_id}`} source={source} styles={styles} colors={colors} />
            ))}
          </>
        ) : null}
      </View>
    </View>
  )
}

export const AssistantTurnCard = memo(AssistantTurnCardComponent)
