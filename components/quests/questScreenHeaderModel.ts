import type Feather from '@expo/vector-icons/Feather'

import type { ScreenHeaderConfig } from '@/components/layout/ScreenHeaderContext'
import type { ActionListSheetItem } from '@/components/ui/ActionListSheet'
import { translate as i18nT, translatePlural } from '@/i18n'
import { formatInteger } from '@/i18n/format'
import { hasPublicQuestRating } from '@/api/questRating'
import { formatRatingValue } from '@/utils/ratingHelpers'
import type { QuestCountModel } from '@/utils/questCountModel'

export type OfflineQuestDownloadState = 'idle' | 'downloading' | 'done'

/**
 * Вид действия «Скачать квест для офлайна» в каждом состоянии. Одна таблица на
 * кнопку панели desktop и главное действие строки экрана телефона (#2148).
 */
export function describeOfflineQuestAction(state: OfflineQuestDownloadState): {
  icon: keyof typeof Feather.glyphMap
  label: string
  accessibilityLabel: string
} {
  if (state === 'downloading') {
    return {
      icon: 'download-cloud',
      label: i18nT('quests:components.quests.questWizardShell.sohranyaem_5a4299e9'),
      accessibilityLabel: i18nT('quests:components.quests.questWizardShell.idet_sohranenie_kvesta_dlya_oflayna_a2c2314e'),
    }
  }
  if (state === 'done') {
    return {
      icon: 'check-circle',
      label: i18nT('quests:components.quests.questWizardShell.sohraneno_oflayn_6e50f89e'),
      accessibilityLabel: i18nT('quests:components.quests.questWizardShell.kvest_sohranen_dlya_oflayna_5c4ef716'),
    }
  }
  return {
    icon: 'download-cloud',
    label: i18nT('quests:components.quests.questWizardShell.skachat_oflayn_b6488863'),
    accessibilityLabel: i18nT('quests:components.quests.questWizardShell.skachat_kvest_dlya_oflayna_1b7e958c'),
  }
}

/**
 * Сведения о квесте от страницы: на телефоне они уходят в лист (i) и в «⋯»
 * строки экрана, на desktop страница рисует их своими чипами (`ratingSlot`,
 * `completionSlot`).
 */
export type QuestScreenMeta = {
  isCompletedByMe: boolean
  completionsCount: number
  /** Отзывы о квесте; `count === 0` — отзывов нет. */
  rating: { count: number; average: number | null }
  /** Читалка отзывов; передаётся, когда отзывы есть. */
  onOpenReviews?: () => void
  /** Форма отзыва; передаётся, когда квест пройден и отзыва ещё нет. */
  onLeaveReview?: () => void
}

export type QuestScreenHeaderInput = {
  title: string
  countModel: QuestCountModel
  meta?: QuestScreenMeta
  offlineQuestState: OfflineQuestDownloadState
  canPrint: boolean
  offlineMapPointsCount: number
  onOfflineQuestDownload: () => void
  onOpenFontScale: () => void
  onPrint: () => void
  onOfflineMapDownload: () => void
  onOfflineMapOpenInApp: () => void
  onReset: () => void
}

/** Абзацы листа (i): статус, прохождения, рейтинг, разбивка точек. */
function buildQuestInfo(countModel: QuestCountModel, meta?: QuestScreenMeta): string[] {
  const info: string[] = []
  if (meta?.isCompletedByMe) {
    info.push(i18nT('quests:components.quests.QuestCompletionBadge.vy_proshli_etot_kvest_7e00d905'))
  }
  if (meta && meta.completionsCount > 0) {
    info.push(translatePlural('quests:components.quests.QuestCompletionBadge.completionCount', meta.completionsCount))
  }
  if (meta && meta.rating.count > 0) {
    const reviews = translatePlural('quests:app.tabs.quests.city.questId.reviewCount', meta.rating.count)
    // Ниже порога выборки (#1486) средняя оценка не публикуется — только число отзывов.
    info.push(
      hasPublicQuestRating(meta.rating.count)
        ? i18nT('quests:components.quests.questScreenHeader.ratingInfo', {
            value1: formatRatingValue(meta.rating.average ?? 0),
            value2: reviews,
          })
        : reviews,
    )
  }
  // Разбивка — та же строка, что у desktop-панели и `QuestTrustBar`; она есть
  // всегда, поэтому (i) у экрана постоянная и строка не перекладывается.
  info.push(
    countModel.source === 'explicit'
      ? i18nT('quests:components.quests.questWizardShell.countBreakdown', {
          total: countModel.total,
          required: countModel.required,
          optional: countModel.optional,
          start: countModel.start,
          final: countModel.final,
        })
      : translatePlural('quests:components.quests.QuestTrustBar.pointsCount', countModel.total),
  )
  return info
}

/**
 * #2148: шапка экрана прохождения квеста на телефоне — §12
 * `docs/features/mobile-screen-shell-mock.md`. Порядок «⋯» фиксирован;
 * недоступное не показывается (мёртвая строка меню запрещена), сброс —
 * последним и `destructive` (разделитель над ним рисует лист).
 */
export function buildQuestScreenHeader(input: QuestScreenHeaderInput): ScreenHeaderConfig {
  const { meta, offlineMapPointsCount } = input
  const offline = describeOfflineQuestAction(input.offlineQuestState)

  const overflow: ActionListSheetItem[] = [
    {
      key: 'font-size',
      label: i18nT('quests:components.quests.questScreenHeader.fontSize'),
      icon: 'type',
      onPress: input.onOpenFontScale,
      testID: 'quest-menu-font-size',
    },
    ...(input.canPrint
      ? [{
          key: 'print',
          label: i18nT('quests:components.quests.questWizardShell.pechat_76bdeffe'),
          accessibilityLabel: i18nT('quests:components.quests.questWizardShell.pechat_kvesta_f66c15e3'),
          icon: 'printer' as const,
          onPress: input.onPrint,
          testID: 'quest-menu-print',
        }]
      : []),
    ...(offlineMapPointsCount > 0
      ? [
          {
            key: 'gpx',
            label: i18nT('quests:components.quests.questWizardShell.skachat_gpx_a032dca6'),
            accessibilityLabel: translatePlural(
              'quests:components.quests.questWizardShell.skachat_gpx_s_value1_tochkami_kvesta_83ac2431',
              offlineMapPointsCount,
            ),
            icon: 'download' as const,
            onPress: input.onOfflineMapDownload,
            testID: 'quest-menu-gpx',
          },
          {
            key: 'maps',
            label: i18nT('quests:components.quests.questWizardShell.otkryt_v_prilozhenii_818b6173'),
            accessibilityLabel: i18nT(
              'quests:components.quests.questWizardShell.otkryt_tochki_kvesta_v_prilozhenii_kart_acb9e920',
            ),
            icon: 'external-link' as const,
            onPress: input.onOfflineMapOpenInApp,
            testID: 'quest-menu-maps',
          },
        ]
      : []),
    ...(meta?.onOpenReviews && meta.rating.count > 0
      ? [{
          key: 'reviews',
          label: i18nT('quests:components.quests.questScreenHeader.reviews', {
            value1: formatInteger(meta.rating.count),
          }),
          icon: 'message-circle' as const,
          onPress: meta.onOpenReviews,
          testID: 'quest-menu-reviews',
        }]
      : []),
    ...(meta?.onLeaveReview
      ? [{
          key: 'leave-review',
          label: i18nT('quests:components.quests.QuestReviewInvite.cta'),
          icon: 'star' as const,
          onPress: meta.onLeaveReview,
          testID: 'quest-menu-leave-review',
        }]
      : []),
    {
      key: 'reset',
      label: i18nT('quests:components.quests.questWizardShell.sbrosit_progress_5f45dc36'),
      icon: 'rotate-ccw',
      onPress: input.onReset,
      destructive: true,
      testID: 'quest-menu-reset',
    },
  ]

  return {
    title: input.title,
    info: buildQuestInfo(input.countModel, meta),
    primaryAction: {
      icon: offline.icon,
      label: offline.accessibilityLabel,
      onPress: input.onOfflineQuestDownload,
      disabled: input.offlineQuestState === 'downloading',
      testID: 'quest-header-offline',
    },
    overflow,
  }
}
