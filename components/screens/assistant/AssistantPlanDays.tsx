/**
 * План по дням под вопросом ассистента (#3298): «Спланируй два дня в Кракове» → дни с карточками материалов
 * сайта и кнопка «Открыть в планировщике».
 *
 * Карточки — те же, что под обычным ответом (#3295, `AssistantSourceCards`): обложка, название, место,
 * «В план поездки» и «На карте»; вместо метки «Из ответа» — время на материал. Заголовок дня несёт сумму
 * часов. Если материалов хватило на меньше дней, чем просили, под заголовком стоит фраза об этом. Все
 * подписи — из локали: текста модели в блоке нет.
 *
 * «Открыть в планировщике» кладёт план черновиком в хранилище (`utils/tripPlanDraft.ts`) и открывает форму
 * новой поездки с его идентификатором: точки встают в маршрут по дням, разбивка — в описание. Гость
 * сначала входит и возвращается в ту же форму (`usePlanTripFromSource`), черновик ждёт его в хранилище.
 */

import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import type { AiTripPlan, AiTripPlanItem } from '@/api/aiAssist/planProvider'
import type { AiSource } from '@/api/aiAssist/types'
import UIButton from '@/components/ui/Button'
import { usePlanTripFromSource } from '@/hooks/usePlanTripFromSource'
import { useAuthStore } from '@/stores/authStore'
import type { ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT, translatePlural } from '@/i18n'
import { formatInteger, formatNumber } from '@/i18n/format'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { buildTripPlanDraftHref, saveTripPlanDraft, type TripPlanDraftInput } from '@/utils/tripPlanDraft'

import { AssistantSourceCards } from './AssistantSourceCards'
import type { AssistantStyles } from './assistantStyles'

/** Событие кнопки «Открыть в планировщике»: число дней и материалов плана, кто его собрал. */
export const ASSISTANT_PLAN_OPEN_EVENT = 'AiAssistant_PlanOpen'

/** Часы показываются с одним знаком после запятой: «4,5 ч». */
const HOURS_FORMAT: Intl.NumberFormatOptions = { maximumFractionDigits: 1 }
const itemKey = (item: { type: string; source_id: string }): string => `${item.type}:${item.source_id}`

const toSource = (item: AiTripPlanItem): AiSource => ({
  type: item.type,
  source_id: item.source_id,
  title: item.title,
  url: item.url,
  path: item.path,
  snippet: '',
  score: 0,
  cover: item.cover,
  city: item.city,
  country: item.country,
  lat: item.lat,
  lng: item.lng,
})

/** Текст разбивки по дням для описания поездки: «День 1: «Квест…» (≈ 2 ч), «Статья…» (≈ 4 ч)». */
export const planDescription = (question: string, plan: AiTripPlan): string =>
  [
    question.trim(),
    ...plan.days.map(
      (day, index) =>
        `${i18nT('aiAssistStatic:ask.planDay', { day: formatInteger(index + 1) })}: ` +
        day.items.map((item) => `«${item.title}» (${i18nT('aiAssistStatic:ask.planItemHours', { hours: formatNumber(item.hours, HOURS_FORMAT) })})`).join(', '),
    ),
  ]
    .filter(Boolean)
    .join('\n')

/** План → черновик маршрута: точки с координатами в порядке дней; материал без координат точкой не становится. */
export const planToDraft = (question: string, plan: AiTripPlan): TripPlanDraftInput => ({
  title: question.trim(),
  description: planDescription(question, plan),
  days: plan.days.length,
  points: plan.days.flatMap((day, index) =>
    day.items.flatMap((item) =>
      item.lat === null || item.lng === null
        ? []
        : [{ type: item.type, sourceId: Number(item.source_id) || null, title: item.title, lat: item.lat, lng: item.lng, day: index + 1, note: item.url }],
    ),
  ),
})

type Props = {
  plan: AiTripPlan
  question: string
  styles: AssistantStyles
  colors: ThemedColors
  narrow: boolean
}

function AssistantPlanDaysComponent({ plan, question, styles, colors, narrow }: Props) {
  const { planTrip } = usePlanTripFromSource()
  // Владелец черновика: черновик вошедшего не подхватит другой аккаунт на том же устройстве; гостевой — общий.
  const owner = useAuthStore((s) => (s.isAuthenticated && s.userId ? s.userId : null))
  const [opening, setOpening] = useState(false)
  // Двойное нажатие в одном кадре видит прежнее `opening`: синхронный замок не даёт открыть форму дважды.
  const openingRef = useRef(false)
  const hoursByKey = useMemo(() => new Map(plan.days.flatMap((day) => day.items.map((item) => [itemKey(item), item.hours] as const))), [plan])
  const sourcesByDay = useMemo(() => plan.days.map((day) => day.items.map(toSource)), [plan])
  const markerOf = useCallback(
    (source: AiSource) => i18nT('aiAssistStatic:ask.planItemHours', { hours: formatNumber(hoursByKey.get(itemKey(source)) ?? 0, HOURS_FORMAT) }),
    [hoursByKey],
  )
  const draft = useMemo(() => planToDraft(question, plan), [plan, question])

  const openPlanner = useCallback(async () => {
    if (openingRef.current) return
    openingRef.current = true
    setOpening(true)
    try {
      void sendAnalyticsEvent(ASSISTANT_PLAN_OPEN_EVENT, { days: plan.days.length, items: draft.points.length, assembled: plan.assembled })
      const id = await saveTripPlanDraft(draft, owner)
      // Хранилище недоступно — форма откроется пустой: посетитель не остаётся перед мёртвой кнопкой.
      planTrip(id ? buildTripPlanDraftHref(id) : '/trips/plan/create')
    } finally {
      openingRef.current = false
      setOpening(false)
    }
  }, [draft, owner, plan.assembled, plan.days.length, planTrip])

  const short = plan.days.length < plan.daysRequested

  return (
    <View style={styles.planBlock} testID="assistant-plan">
      <Text style={styles.sourcesTitle} accessibilityRole="header">
        {i18nT('aiAssistStatic:ask.planTitle')}
      </Text>
      {short ? (
        <Text style={styles.noticeText} testID="assistant-plan-short">
          {translatePlural('aiAssistStatic:ask.planShort', plan.days.length)}
        </Text>
      ) : null}
      {plan.days.map((day, index) => {
        const total = day.items.reduce((sum, item) => sum + item.hours, 0)
        return (
          <View key={`day-${index + 1}`} style={styles.planDay} testID={`assistant-plan-day-${index + 1}`}>
            <View style={styles.planDayHead}>
              <Text style={styles.planDayTitle} accessibilityRole="header">
                {i18nT('aiAssistStatic:ask.planDay', { day: formatInteger(index + 1) })}
              </Text>
              <Text style={styles.planDayHours}>{i18nT('aiAssistStatic:ask.planDayHours', { hours: formatNumber(total, HOURS_FORMAT) })}</Text>
            </View>
            <AssistantSourceCards sources={sourcesByDay[index]} colors={colors} narrow={narrow} markerOf={markerOf} railTestID={`assistant-plan-cards-${index + 1}`} />
          </View>
        )
      })}
      <Text style={styles.noticeText}>{i18nT('aiAssistStatic:ask.planHint')}</Text>
      <View style={styles.noticeActions}>
        <UIButton
          label={i18nT('aiAssistStatic:ask.planOpen')}
          variant="primary"
          icon={<Feather name="map" size={18} color={colors.textOnPrimary} />}
          onPress={openPlanner}
          loading={opening}
          disabled={opening || draft.points.length === 0}
          testID="assistant-plan-open"
        />
      </View>
    </View>
  )
}

export const AssistantPlanDays = memo(AssistantPlanDaysComponent)
