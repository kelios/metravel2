// components/quests/QuestFinaleInviteAction.tsx
// «Позвать друга» на финале квеста (#3230). Отличается от «Поделиться
// результатом» адресатом: другу нужен сам маршрут, поэтому ссылка ведёт на
// страницу квеста (`buildQuestInviteLink`), без диплома и без запроса к
// генератору карточки. С языковой страницы — на ту же языковую страницу, если
// сервер её отдаёт (#3379). Канал один — `shareOrCopy`.

import { useCallback } from 'react'
import Feather from '@expo/vector-icons/Feather'
import * as Clipboard from 'expo-clipboard'

import Button from '@/components/ui/Button'
import { useThemedColors } from '@/hooks/useTheme'
import { useQuestVersionNavigation } from '@/hooks/useQuestVersionNavigation'
import { translate as i18nT } from '@/i18n'
import { trackQuestInviteClick } from '@/utils/gamificationAnalytics'
import { buildQuestInviteLink } from '@/utils/questResultShare'
import { shareOrCopy } from '@/utils/shareOrCopy'
import { showToast } from '@/utils/toast'

type Props = {
  questId: string
  questTitle: string
  cityId?: string
}

export default function QuestFinaleInviteAction({ questId, questTitle, cityId }: Props) {
  const colors = useThemedColors()

  const projection = useQuestVersionNavigation()?.projection ?? null

  const handlePress = useCallback(async () => {
    const link = buildQuestInviteLink(cityId, questId, projection)
    const text = i18nT('questShareStatic:finaleInvite.text', { title: questTitle })
    const outcome = await shareOrCopy({
      web: { title: questTitle, text, url: link },
      native: { message: `${text} ${link}`, title: questTitle },
      copyText: `${text} ${link}`,
      copy: Clipboard.setStringAsync,
    })
    if (outcome === 'shared') {
      trackQuestInviteClick({ questId, channel: 'native' })
    } else if (outcome === 'copied') {
      trackQuestInviteClick({ questId, channel: 'copy' })
      showToast({ type: 'success', text1: i18nT('questShareStatic:finaleShare.linkCopied'), visibilityTime: 2000 })
    } else if (outcome === 'failed') {
      showToast({ type: 'error', text1: i18nT('questShareStatic:finaleShare.copyFailed'), visibilityTime: 2500 })
    }
  }, [cityId, questId, questTitle, projection])

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
