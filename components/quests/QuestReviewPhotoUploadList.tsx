// components/quests/QuestReviewPhotoUploadList.tsx
// Статусы загрузки фото отзыва после отправки (#2150).
//
// Один статус на снимок («В очереди», «Сжимаем…», «63 %», «Загружено»,
// «Не загрузилось» + «Повторить») и одна итоговая строка «Загружено N из M».
// Раньше здесь показывался неактивный пикер «Выбрано 3 из 3» с двумя
// параллельными «Загружаем…»: было не понять, идёт загрузка или зависла.
// Таблица состояний — docs/features/quests.md → «Пользовательские флоу».

import { memo, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { QUEST_REVIEW_THUMB_SIZE } from '@/components/quests/QuestReviewPhotoPicker'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { QuestReviewUploadItem } from '@/stores/questReviewUploadStore'
import { translate as i18nT } from '@/i18n'
import { formatInteger, formatNumber } from '@/i18n/format'

/** Минимальная цель нажатия проекта (`scripts/guard-touch-targets.js`). */
const RETRY_HIT_SIZE = 44

export const questReviewPhotoStatusLabel = (item: QuestReviewUploadItem): string => {
  switch (item.status) {
    case 'queued':
      return i18nT('quests:components.quests.QuestReviewPhotoUploadList.statusQueued')
    case 'compressing':
      return i18nT('quests:components.quests.QuestReviewPhotoUploadList.statusCompressing')
    case 'uploading':
      return formatNumber(item.progress, { style: 'percent', maximumFractionDigits: 0 })
    case 'uploaded':
      return i18nT('quests:components.quests.QuestReviewPhotoUploadList.statusUploaded')
    case 'failed':
      return i18nT('quests:components.quests.QuestReviewPhotoUploadList.statusFailed')
  }
}

type Props = {
  items: QuestReviewUploadItem[]
  uploaded: number
  total: number
  isActive: boolean
  onRetry: (key: string) => void
  testID?: string
}

function QuestReviewPhotoUploadList({
  items,
  uploaded,
  total,
  isActive,
  onRetry,
  testID = 'quest-review-photo-upload',
}: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  if (items.length === 0) return null

  const hasFailed = items.some((item) => item.status === 'failed')

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.thumbRow}>
        {items.map((item) => {
          const label = questReviewPhotoStatusLabel(item)
          const failed = item.status === 'failed'
          return (
            <View key={item.key} style={styles.thumbWrapper} testID={`${testID}-item-${item.key}`}>
              <View style={[styles.thumb, failed && styles.thumbFailed]}>
                {/* Тот же примитив, что у пикера (ADR 0002): локальный uri прокси не трогает. */}
                <ImageCardMedia
                  src={item.previewUri}
                  width={QUEST_REVIEW_THUMB_SIZE}
                  height={QUEST_REVIEW_THUMB_SIZE}
                  fit="contain"
                  alt={item.name}
                  style={styles.thumbImage}
                  testID={`${testID}-preview-${item.key}`}
                />
              </View>
              {/* Статус — текстом, а не только цветом рамки: иначе его нет для
                  экранного диктора. */}
              <Text
                style={[styles.statusText, failed && styles.statusTextFailed]}
                accessibilityLabel={
                  item.status === 'uploading'
                    ? i18nT('quests:components.quests.QuestReviewPhotoUploadList.statusUploadingA11y', { value1: label })
                    : undefined
                }
                testID={`${testID}-status-${item.key}`}
              >
                {label}
              </Text>
              {failed && (
                <Pressable
                  onPress={() => onRetry(item.key)}
                  style={styles.retryButton}
                  accessibilityRole="button"
                  accessibilityLabel={i18nT('quests:components.quests.QuestReviewPhotoUploadList.retryA11y', { value1: item.name })}
                  testID={`${testID}-retry-${item.key}`}
                >
                  <Feather name="refresh-cw" size={13} color={colors.primaryText} />
                  <Text style={styles.retryText}>{i18nT('quests:components.quests.QuestReviewPhotoUploadList.retry')}</Text>
                </Pressable>
              )}
            </View>
          )
        })}
      </View>

      <Text
        style={styles.summaryText}
        accessibilityLiveRegion="polite"
        testID={`${testID}-summary`}
      >
        {i18nT('quests:components.quests.QuestReviewPhotoUploadList.summary', { value1: formatInteger(uploaded), value2: formatInteger(total) })}
      </Text>

      {/* Отзыв уже сохранён: недоехал конкретный снимок, и путь к нему — его кнопка. */}
      {!isActive && hasFailed && (
        <Text style={styles.failedHint} accessibilityRole="alert" testID={`${testID}-failed-hint`}>
          {i18nT('quests:components.quests.QuestReviewPhotoUploadList.failedHint')}
        </Text>
      )}
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    container: {
      gap: 8,
    },
    thumbRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    thumbWrapper: {
      width: QUEST_REVIEW_THUMB_SIZE,
      gap: 4,
    },
    thumb: {
      width: QUEST_REVIEW_THUMB_SIZE,
      height: QUEST_REVIEW_THUMB_SIZE,
      borderRadius: DESIGN_TOKENS.radii.sm,
      overflow: 'hidden',
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    thumbFailed: {
      borderColor: colors.danger,
    },
    thumbImage: {
      width: '100%',
      height: '100%',
    },
    statusText: {
      fontSize: 12,
      lineHeight: 16,
      color: colors.textMuted,
    },
    statusTextFailed: {
      color: colors.danger,
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      minHeight: RETRY_HIT_SIZE,
      minWidth: RETRY_HIT_SIZE,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
    },
    retryText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primaryText,
    },
    summaryText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    failedHint: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.danger,
    },
  })

export default memo(QuestReviewPhotoUploadList)
