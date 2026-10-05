import { useCallback, useState } from 'react'

import { useScreenHeader } from '@/components/layout/ScreenHeaderContext'

import { buildQuestScreenHeader, type QuestScreenHeaderInput } from './questScreenHeaderModel'

/**
 * #2148: декларация шапки экрана прохождения квеста (контракт #2099). Зовёт её
 * визард — единственный владелец действий и сброса. На телефоне строка экрана
 * рисует название, (i), офлайн и «⋯»; на desktop декларация не показывается —
 * действия с подписями остаются в панели визарда.
 *
 * «Размер шрифта» в «⋯» открывает отдельный лист (`QuestFontScaleSheet`): его
 * состояние живёт здесь, рисует лист визард.
 */
export function useQuestScreenHeader(input: Omit<QuestScreenHeaderInput, 'onOpenFontScale'>) {
  const [fontScaleSheetOpen, setFontScaleSheetOpen] = useState(false)
  const openFontScaleSheet = useCallback(() => setFontScaleSheetOpen(true), [])
  const closeFontScaleSheet = useCallback(() => setFontScaleSheetOpen(false), [])

  useScreenHeader(buildQuestScreenHeader({ ...input, onOpenFontScale: openFontScaleSheet }))

  return { fontScaleSheetOpen, closeFontScaleSheet }
}
