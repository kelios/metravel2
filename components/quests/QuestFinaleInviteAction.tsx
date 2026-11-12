// components/quests/QuestFinaleInviteAction.tsx
// «Позвать друга» на финале квеста (#3230). Отличается от «Поделиться
// результатом» адресатом: другу нужен сам маршрут, поэтому ссылка ведёт на
// страницу квеста (`buildQuestInviteLink`), без диплома и без запроса к
// генератору карточки. Канал один — системный лист шаринга; где его нет
// (десктопный браузер), ссылка копируется.

import { useCallback } from 'react'
import { Platform, Share } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import * as Clipboard from 'expo-clipboard'

import Button from '@/components/ui/Button'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { trackQuestInviteClick } from '@/utils/gamificationAnalytics'
import { devWarn } from '@/utils/logger'
import { buildQuestInviteLink } from '@/utils/questResultShare'
import { showToast } from '@/utils/toast'

type Props = {
  questId: string
  questTitle: string
  cityId?: string
}

const isAbort = (error: unknown) => (error as { name?: string } | null)?.name === 'AbortError'

export default function QuestFinaleInviteAction({ questId, questTitle, cityId }: Props) {
  const colors = useThemedColors()

  const handlePress = useCallback(async () => {
    const link = buildQuestInviteLink(cityId, questId)
    const text = i18nT('questShareStatic:finaleInvite.text', { title: questTitle })
    try {
      if (Platform.OS !== 'web') {
        const result = await Share.share({ message: `${text} ${link}`, title: questTitle })
        if (result.action === Share.sharedAction) trackQuestInviteClick({ questId, channel: 'native' })
        return
      }
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: questTitle, text, url: link })
        trackQuestInviteClick({ questId, channel: 'native' })
        return
      }
      await Clipboard.setStringAsync(`${text} ${link}`)
      trackQuestInviteClick({ questId, channel: 'copy' })
      showToast({ type: 'success', text1: i18nT('questShareStatic:finaleShare.linkCopied'), visibilityTime: 2000 })
    } catch (error) {
      if (isAbort(error)) return
      devWarn('[QuestFinaleInviteAction] invite failed', error)
      showToast({ type: 'error', text1: i18nT('questShareStatic:finaleShare.copyFailed'), visibilityTime: 2500 })
    }
  }, [cityId, questId, questTitle])

  return (
    <Button
      label={i18nT('questShareStatic:finaleInvite.button')}
      variant="outline"
      icon={<Feather name="user-plus" size={18} color={colors.text} />}
      onPress={() => { void handlePress() }}
      testID="quest-finale-invite"
    />
  )
}
