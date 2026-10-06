import { useEffect, useRef } from 'react'

import { generatePrintableQuest } from '@/components/quests/QuestPrintable'
import { notifyQuest } from '@/components/quests/questWizardHelpers'
import { translate as i18nT } from '@/i18n'
import { isLoopQuest } from '@/utils/questAudience'
import type { FrontendQuestBundle } from '@/utils/questAdapters'

/** Query-параметр адреса печатной версии квеста: `/quests/{city}/{id}?print=1`. */
export const QUEST_PRINT_PARAM = 'print'

export function isQuestPrintRequested(value: string | string[] | undefined): boolean {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === '1' || raw === 'true'
}

type Options = {
  enabled: boolean
  bundle: FrontendQuestBundle | null
  /** Канонический адрес квеста без `?print=1` — для QR «квест на сайте». */
  questUrl: string
}

/**
 * Адрес печатной версии квеста (ссылка из письма «квест на почту»). Как только
 * квест загружен, открывает ту же печатную версию, что кнопка «Печать» в квесте:
 * на web — в этой вкладке (жеста нет, попап был бы заблокирован), на native —
 * системный просмотр печати. Не зависит от согласия на старт квеста: печать
 * прохождение не начинает. Открывается один раз за жизнь экрана.
 */
export function useQuestPrintLanding({ enabled, bundle, questUrl }: Options): void {
  const startedRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  // Ушёл с экрана (blur/unmount), пока печатная версия собиралась, — не писать её
  // поверх следующей страницы.
  useEffect(() => {
    if (!enabled) abortRef.current?.abort()
  }, [enabled])
  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    // `tags === undefined` — классификация квеста ещё летит (detail-API тегов не
    // отдаёт, хук бандла дообогащает их из списка; при сбое — `[]`). Без тегов
    // кольцевой квест напечатался бы с незамкнутым маршрутом.
    if (!enabled || !bundle || bundle.tags === undefined || startedRef.current) return
    startedRef.current = true
    const controller = new AbortController()
    abortRef.current = controller
    generatePrintableQuest(
      {
        title: bundle.title,
        steps: bundle.steps,
        intro: bundle.intro,
        coverUrl: bundle.coverUrl,
        questUrl,
        finaleText: bundle.finale?.text,
        closeLoop: isLoopQuest(bundle.tags),
      },
      { inPlace: true, signal: controller.signal },
    )
      .then((result) => {
        if (result === 'unavailable') notifyQuest(i18nT('common:print.unavailable'))
      })
      .catch(() => notifyQuest(i18nT('common:print.unavailable')))
  }, [bundle, enabled, questUrl])
}
