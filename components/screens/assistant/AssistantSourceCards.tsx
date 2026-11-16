import { memo, useCallback, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useRouter } from 'expo-router'

import type { AiPickItem } from '@/api/aiPicks'
import type { AiSource } from '@/api/aiAssist/types'
import { AiPickCard } from '@/components/aiPicks/AiPickCard'
import TravelStatusButton from '@/components/travel/TravelStatusButton'
import UIButton from '@/components/ui/Button'
import CardRail from '@/components/ui/CardRail'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { usePlanTripFromSource } from '@/hooks/usePlanTripFromSource'
import type { ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { buildTripPlanCreateHrefFromQuest } from '@/utils/tripPlanLinks'

import { sourceCoordinates } from './answerSources'

/**
 * Карточки материалов, которые ассистент назвал в ответе (#3295): обложка, название, место и два
 * действия — «В план поездки» и «На карте». Раньше под ответом стояли строки с заголовком: чтобы собрать
 * из совета поездку, посетитель открывал три вкладки и на каждой искал кнопку.
 *
 * Карточка — общий `AiPickCard` блоков подбора в компактном виде. «В план поездки» у статьи — та же
 * кнопка, что на странице статьи (`TravelStatusButton`: гость — вход с сохранённым намерением, вошедший —
 * выбор статуса и даты, уже в плане — статус на кнопке); у квеста — новая поездка по квесту тем же
 * действием, что «Организовать поездку по маршруту» статьи (`usePlanTripFromSource`). «На карте» —
 * `/map` с центром в координатах карточки; без координат действия нет.
 */
export const ASSISTANT_CARDS_BLOCK = 'assistant'
/** Событие действий карточки под ответом: `action` — `plan` или `map`, `type` и `id` материала. */
export const ASSISTANT_SOURCE_ACTION_EVENT = 'AiAssistant_SourceAction'

const RAIL_GAP = 12
const SLOT_WIDTH = 240
const SLOT_WIDTH_NARROW = 216

const toPickItem = (source: AiSource): AiPickItem => ({
  type: source.type === 'quest' ? 'quest' : 'travel',
  source_id: Number(source.source_id) || 0,
  title: source.title,
  url: source.url,
  path: source.path,
  snippet: source.snippet,
  score: source.score,
  city: source.city ?? null,
  country: source.country ?? null,
  lat: source.lat ?? null,
  lng: source.lng ?? null,
  cover: source.cover ?? null,
})

type CardProps = {
  source: AiSource
  slotWidth: number
  colors: ThemedColors
  styles: ReturnType<typeof createStyles>
  /** Метка на обложке; по умолчанию — «Из ответа». План по дням (#3298) ставит сюда время на материал. */
  markerLabel?: string
}

const SourceCard = memo(function SourceCard({ source, slotWidth, colors, styles, markerLabel }: CardProps) {
  const router = useRouter()
  const { planTrip, plannerImpression } = usePlanTripFromSource('assistant')
  const item = useMemo(() => toPickItem(source), [source])
  const coordinates = sourceCoordinates(source)
  const track = useCallback(
    (action: 'plan' | 'map') => void sendAnalyticsEvent(ASSISTANT_SOURCE_ACTION_EVENT, { action, type: item.type, id: item.source_id }),
    [item.source_id, item.type],
  )

  const planQuest = useCallback(() => {
    track('plan')
    // Координаты квеста едут в форму поездки: после создания квест встаёт точкой её маршрута (#3416 п.1).
    planTrip(buildTripPlanCreateHrefFromQuest({ title: source.title, url: source.url, description: source.snippet, lat: coordinates?.lat, lng: coordinates?.lng }))
  }, [coordinates?.lat, coordinates?.lng, planTrip, source.snippet, source.title, source.url, track])
  const trackPlan = useCallback(() => track('plan'), [track])

  const openMap = useCallback(() => {
    if (!coordinates) return
    track('map')
    router.push({ pathname: '/map', params: { lat: String(coordinates.lat), lng: String(coordinates.lng), placeTitle: source.title, focusPlace: '1' } } as never)
  }, [coordinates, router, source.title, track])

  const planLabel = i18nT('aiAssistStatic:ask.planTrip')
  const mapLabel = i18nT('aiAssistStatic:ask.onMap')

  return (
    <View style={{ width: slotWidth }}>
      <AiPickCard
        item={item}
        slotWidth={slotWidth}
        compact
        markerLabel={markerLabel ?? i18nT('aiAssistStatic:ask.recommendedBadge')}
        analyticsBlock={ASSISTANT_CARDS_BLOCK}
        testID={`assistant-source-card-${source.type}-${source.source_id}`}
        actionSlot={
          <View style={styles.actions}>
            {source.type === 'travel' ? (
              <TravelStatusButton
                travelId={source.source_id}
                travelTitle={source.title}
                travelUrl={source.path}
                travelImageUrl={source.cover ?? undefined}
                travelCountry={source.country ?? undefined}
                idleLabel={planLabel}
                onActivate={trackPlan}
              />
            ) : (
              <UIButton
                label={planLabel}
                accessibilityLabel={`${planLabel}: ${source.title}`}
                variant="soft"
                size="sm"
                icon={<Feather name="calendar" size={16} color={colors.primaryDark} />}
                onPress={planQuest}
                testID={`assistant-source-plan-${source.type}-${source.source_id}`}
                ref={plannerImpression.ref}
              />
            )}
            {coordinates ? (
              <UIButton
                label={mapLabel}
                accessibilityLabel={`${mapLabel}: ${source.title}`}
                variant="tonal"
                size="sm"
                icon={<Feather name="map-pin" size={16} color={colors.primaryText} />}
                onPress={openMap}
                testID={`assistant-source-map-${source.type}-${source.source_id}`}
              />
            ) : null}
          </View>
        }
      />
    </View>
  )
})

type Props = {
  sources: readonly AiSource[]
  colors: ThemedColors
  /** Узкая раскладка: карточка уже, ряд прокручивается внутри себя — страница вбок не едет. */
  narrow: boolean
  /** Своя метка карточки вместо «Из ответа» (#3298: время на материал в плане по дням). */
  markerOf?: (source: AiSource) => string
  /** Свой testID ряда: в плане по дням рядов несколько. */
  railTestID?: string
}

function AssistantSourceCardsComponent({ sources, colors, narrow, markerOf, railTestID = 'assistant-source-cards' }: Props) {
  const styles = useMemo(() => createStyles(), [])
  if (!sources.length) return null
  const slotWidth = narrow ? SLOT_WIDTH_NARROW : SLOT_WIDTH
  return (
    <CardRail gap={RAIL_GAP} contentPaddingVertical={4} accessibilityLabel={i18nT('aiAssistStatic:ask.sourcesTitle')} testID={railTestID}>
      {sources.map((source) => (
        <SourceCard key={`${source.type}-${source.source_id}`} source={source} slotWidth={slotWidth} colors={colors} styles={styles} markerLabel={markerOf?.(source)} />
      ))}
    </CardRail>
  )
}

const createStyles = () =>
  StyleSheet.create({
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.xs,
    },
  })

export const AssistantSourceCards = memo(AssistantSourceCardsComponent)
