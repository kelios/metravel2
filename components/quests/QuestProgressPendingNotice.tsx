// Пометка «прохождение ещё не отправлено» (#1922).
//
// Очередь доставки переживает офлайн и выгрузку приложения, но без видимой
// пометки игрок не отличает «квест не засчитан» от «ещё едет»: до #1922
// прохождение молча оставалось на телефоне. Пометка исчезает сама, как только
// снапшот уехал, — она подписана на состав очереди.

import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { getQueuedQuestIds, subscribeQuestProgressQueue } from '@/utils/questProgressQueue'

/** Ждёт ли снапшот этого квеста отправки на сервер. */
export function useQuestProgressPending(questId: string | undefined): boolean {
  const [isPending, setIsPending] = useState(() => (questId ? getQueuedQuestIds().includes(questId) : false))

  useEffect(() => {
    if (!questId) {
      setIsPending(false)
      return
    }
    return subscribeQuestProgressQueue((questIds) => setIsPending(questIds.includes(questId)))
  }, [questId])

  return isPending
}

export default function QuestProgressPendingNotice({ questId }: { questId: string | undefined }) {
  const colors = useThemedColors()
  const isPending = useQuestProgressPending(questId)

  if (!isPending) return null

  const label = i18nT('quests:components.quests.QuestProgressPendingNotice.pendingDelivery')

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.chip, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
      testID="quest-progress-pending"
    >
      <Feather name="upload-cloud" size={13} color={colors.textMuted} />
      <Text style={[styles.chipText, { color: colors.textMuted }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 4,
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
})
