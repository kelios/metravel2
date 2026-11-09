import React from 'react'
import { Text, View } from 'react-native'

import { translate as i18nT } from '@/i18n'
import type { QuestCountModel } from '@/utils/questCountModel'

/**
 * Полоса прогресса квеста со счётчиком заданий и разбором точек — общая для
 * мобильной шапки и desktop-сайдбара. #3219: до старта (`introActive`) — только
 * полоса; единственное число точек на странице — строка «Бесплатно · …».
 */
export default function QuestProgressSummary({
  styles,
  progress,
  completedCount,
  stepsCount,
  countModel,
  isMobile = false,
  showBreakdown = true,
  showCounter = true,
  introActive,
}: {
  styles: any
  progress: number
  completedCount: number
  stepsCount: number
  countModel: QuestCountModel
  introActive: boolean
  /**
   * Включает горизонтальную компоновку; мобильный caller отдельно
   * скрывает обе подписи флагами ниже.
   */
  isMobile?: boolean
  /**
   * #1669: на телефоне счётчик уехал в ряд действий — там после переезда редких
   * кнопок в «Ещё» освободилось место, и полоса прогресса схлопывается до
   * 3px-волосины вместо собственной строки в 16px текста.
   */
  showCounter?: boolean
  /** Разбор «сколько обязательных/необязательных» — вторая строка текста, на телефоне лишняя. */
  showBreakdown?: boolean
}) {
  return (
    <View style={[styles.progressContainer, isMobile && styles.progressRowMobile]}>
      <View style={[styles.progressBar, isMobile && styles.progressBarMobile]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      {showCounter && !introActive && (
        <Text style={styles.progressText}>
          {i18nT('quests:components.quests.questWizardShell.progressTasks', {
            completed: completedCount,
            total: stepsCount,
          })}
        </Text>
      )}
      {showBreakdown && !introActive && countModel.source === 'explicit' && (
        <Text style={styles.progressBreakdownText}>
          {i18nT('quests:components.quests.questWizardShell.countBreakdown', {
            total: countModel.total,
            required: countModel.required,
            optional: countModel.optional,
            start: countModel.start,
            final: countModel.final,
          })}
        </Text>
      )}
    </View>
  )
}
