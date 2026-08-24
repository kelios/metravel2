import React, { useCallback, useSyncExternalStore } from 'react'
import { Platform } from 'react-native'

import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { translate as i18nT } from '@/i18n'

import {
  getQuestConfirmRequest,
  resolveQuestConfirm,
  subscribeQuestConfirm,
} from './questConfirmStore'

const getServerSnapshot = () => null

/**
 * Хост подтверждений квеста: показывает дизайн-системный `ConfirmDialog` по запросу
 * из `questConfirmStore` и возвращает ответ в промис `confirmQuestAsync`.
 *
 * Монтируется один раз в `QuestWizard`. На native не рендерится: там подтверждение
 * идёт через `Alert.alert` в самом хелпере.
 */
const QuestConfirmHost = () => {
  const request = useSyncExternalStore(subscribeQuestConfirm, getQuestConfirmRequest, getServerSnapshot)

  const handleConfirm = useCallback(() => resolveQuestConfirm(true), [])
  const handleClose = useCallback(() => resolveQuestConfirm(false), [])

  if (Platform.OS !== 'web') return null

  return (
    <ConfirmDialog
      visible={!!request}
      title={request?.title}
      message={request?.message}
      confirmText={i18nT('quests:components.quests.questWizardHelpers.ok_eaabc1d8')}
      cancelText={i18nT('quests:components.quests.questWizardHelpers.otmena_9f846483')}
      onConfirm={handleConfirm}
      onClose={handleClose}
      confirmTestID="quest-confirm-accept"
      cancelTestID="quest-confirm-cancel"
    />
  )
}

export default QuestConfirmHost
