import { memo, useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { type AiWorldTrail, type LoadStep, monthRanges, roundAltitude, roundClimb, SAC_GRADE_LABEL } from '@/api/aiAssist/trailFacts'
import UIButton from '@/components/ui/Button'
import type { ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import { formatDate, formatInteger, formatNumber } from '@/i18n/format'
import { sendAnalyticsEvent } from '@/utils/analytics'
import { openExternalUrlInNewTab } from '@/utils/externalLinks'

import type { AssistantStyles } from './assistantStyles'

/**
 * Блок «Ещё в мире» под ответом ассистента (#3357): до трёх известных пеших маршрутов мира из внешнего
 * индекса службы. Материалы сайта стоят выше; здесь — только проверяемые факты карточки (длина, дни, набор
 * высоты, высшая точка, ступень нагрузки, месяцы без снега) и ссылка на статью Википедии или Wikivoyage,
 * которая открывается вне сайта. Текст модели в блок не попадает: карточки собирает код службы.
 *
 * Под блоком — источники данных: OpenStreetMap (ODbL), Wikidata, Copernicus DEM, NASA POWER; обязательные
 * строки лицензий раскрываются по кнопке.
 */
export const WORLD_TRAIL_OPEN_EVENT = 'AiAssistant_WorldTrailOpen'
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright'

const EFFORT_KEYS: Record<LoadStep, string> = {
  walk: 'aiAssistStatic:ask.worldEffort.walk',
  hike: 'aiAssistStatic:ask.worldEffort.hike',
  trained: 'aiAssistStatic:ask.worldEffort.trained',
  alpine: 'aiAssistStatic:ask.worldEffort.alpine',
}

/** Название месяца на языке интерфейса — общим форматтером дат (у белорусской локали свои данные, #2283). */
const monthName = (month: number): string => formatDate(Date.UTC(2024, month - 1, 15), { month: 'long', timeZone: 'UTC' })

/** Месяцы без снега словами локали: «июнь–октябрь», сезон через Новый год — «декабрь–март». */
const monthsText = (months: readonly number[]): string =>
  monthRanges(months)
    .map(([from, to]) => (from === to ? monthName(from) : `${monthName(from)}–${monthName(to)}`))
    .join(', ')

/** Длина, дни, набор и высота одной строкой; факта, которого у карточки нет, в строке нет. */
export const worldFactsText = (trail: AiWorldTrail): string =>
  [
    trail.distance_km ? i18nT('aiAssistStatic:ask.worldFacts.distance', { km: formatNumber(trail.distance_km, { maximumFractionDigits: trail.distance_km >= 20 ? 0 : 1 }) }) : '',
    trail.days ? i18nT(trail.days_estimated ? 'aiAssistStatic:ask.worldFacts.daysEstimated' : 'aiAssistStatic:ask.worldFacts.days', { count: formatInteger(trail.days) }) : '',
    trail.ascent_m ? i18nT('aiAssistStatic:ask.worldFacts.ascent', { m: formatInteger(roundClimb(trail.ascent_m)) }) : '',
    trail.max_alt_m ? i18nT('aiAssistStatic:ask.worldFacts.maxAlt', { m: formatInteger(roundAltitude(trail.max_alt_m)) }) : '',
  ]
    .filter(Boolean)
    .join(' · ')

/** Ступень нагрузки и класс тропы; ступень по классу тропы подписана «по разметке OpenStreetMap». */
export const worldEffortText = (trail: AiWorldTrail): string =>
  [
    trail.effort ? i18nT('aiAssistStatic:ask.worldEffortLabel', { step: i18nT(EFFORT_KEYS[trail.effort]) }) : '',
    trail.grade ? i18nT('aiAssistStatic:ask.worldFacts.grade', { grade: SAC_GRADE_LABEL[trail.grade] }) : '',
    trail.effort && trail.effort_by_grade ? i18nT('aiAssistStatic:ask.worldEffortByGrade') : '',
  ]
    .filter(Boolean)
    .join(' · ')

/** Месяцы без снега по норме; круглогодичный вердикт — отдельной фразой: это не «открыт и рекомендован». */
export const worldMonthsText = (trail: AiWorldTrail): string => {
  if (!trail.months?.length) return ''
  if (trail.months.length === 12) return i18nT('aiAssistStatic:ask.worldFacts.yearRound')
  return i18nT('aiAssistStatic:ask.worldFacts.months', { months: monthsText(trail.months) })
}

type RowProps = {
  trail: AiWorldTrail
  styles: AssistantStyles
  colors: ThemedColors
}

const WorldTrailRow = memo(function WorldTrailRow({ trail, styles, colors }: RowProps) {
  const open = useCallback(() => {
    void sendAnalyticsEvent(WORLD_TRAIL_OPEN_EVENT, { id: trail.source_id })
    void openExternalUrlInNewTab(trail.url)
  }, [trail.source_id, trail.url])
  const facts = worldFactsText(trail)
  const effort = worldEffortText(trail)
  const months = worldMonthsText(trail)
  const source = i18nT(/\.wikivoyage\.org\//i.test(trail.url) ? 'aiAssistStatic:ask.worldSourceWikivoyage' : 'aiAssistStatic:ask.worldSourceWikipedia')
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={[trail.title, trail.country, facts, effort, months].filter(Boolean).join('. ')}
      accessibilityHint={i18nT('aiAssistStatic:ask.worldOpen')}
      onPress={open}
      style={({ pressed }) => [styles.worldRow, pressed && styles.sourceRowPressed]}
      testID={`assistant-world-trail-${trail.source_id}`}
    >
      <View style={styles.sourceIcon}>
        <Feather name="compass" size={16} color={colors.primaryDark} />
      </View>
      <View style={styles.sourceTextCol}>
        {trail.country ? <Text style={styles.sourceType}>{trail.country}</Text> : null}
        <Text style={styles.sourceTitle} numberOfLines={2}>
          {trail.title}
        </Text>
        {facts ? <Text style={styles.worldFacts}>{facts}</Text> : null}
        {effort ? (
          <Text style={styles.worldEffort} testID={`assistant-world-effort-${trail.source_id}`}>
            {effort}
          </Text>
        ) : null}
        {months ? <Text style={styles.worldNote}>{months}</Text> : null}
        <Text style={styles.worldNote}>{`${source} · ${i18nT('aiAssistStatic:ask.worldOpen')}`}</Text>
      </View>
      <Feather name="external-link" size={18} color={colors.textMuted} />
    </Pressable>
  )
})

type Props = {
  trails: readonly AiWorldTrail[]
  styles: AssistantStyles
  colors: ThemedColors
  /** Адрес файла слоя OpenStreetMap под ODbL; служба отдаёт его, когда файл опубликован. */
  layerUrl?: string | null
}

function AssistantWorldTrailsComponent({ trails, styles, colors, layerUrl }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const toggleDetails = useCallback(() => setDetailsOpen((value) => !value), [])
  const openLicense = useCallback(() => void openExternalUrlInNewTab(OSM_COPYRIGHT_URL), [])
  const openLayer = useCallback(() => {
    if (layerUrl) void openExternalUrlInNewTab(layerUrl)
  }, [layerUrl])
  if (!trails.length) return null
  return (
    <View style={styles.turn} testID="assistant-world">
      <Text style={styles.sourcesTitle} accessibilityRole="header">
        {i18nT('aiAssistStatic:ask.worldTitle')}
      </Text>
      {trails.map((trail) => (
        <WorldTrailRow key={trail.source_id} trail={trail} styles={styles} colors={colors} />
      ))}
      <Text style={styles.worldNote} testID="assistant-world-attribution">
        {i18nT('aiAssistStatic:ask.worldAttribution')}
      </Text>
      <View style={styles.noticeActions}>
        <UIButton
          variant="ghost"
          size="sm"
          label={i18nT('aiAssistStatic:ask.worldLicense')}
          icon={<Feather name="external-link" size={16} color={colors.primaryText} />}
          onPress={openLicense}
          testID="assistant-world-license"
        />
        {layerUrl ? (
          <UIButton
            variant="ghost"
            size="sm"
            label={i18nT('aiAssistStatic:ask.worldLayer')}
            icon={<Feather name="download" size={16} color={colors.primaryText} />}
            onPress={openLayer}
            testID="assistant-world-layer"
          />
        ) : null}
        <UIButton
          variant="ghost"
          size="sm"
          label={i18nT(detailsOpen ? 'aiAssistStatic:ask.moreMaterialsCollapse' : 'aiAssistStatic:ask.worldAttributionMore')}
          icon={<Feather name={detailsOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primaryText} />}
          onPress={toggleDetails}
          testID="assistant-world-attribution-toggle"
        />
      </View>
      {detailsOpen ? (
        <Text style={styles.worldNote} testID="assistant-world-attribution-details">
          {i18nT('aiAssistStatic:ask.worldAttributionDetails')}
        </Text>
      ) : null}
    </View>
  )
}

export const AssistantWorldTrails = memo(AssistantWorldTrailsComponent)
