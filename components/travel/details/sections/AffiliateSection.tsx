import React, { useEffect, useMemo, useState } from 'react'
import { Platform, Text, View } from 'react-native'

import type { Travel } from '@/types/types'

import { getAffiliateOffers, isAffiliateEnabled } from '@/components/affiliate/affiliateConfig'
import AffiliateOffers from '@/components/affiliate/AffiliateOffers'
import { translate as i18nT } from '@/i18n'


type FirstPointCoordinates = { lat: number; lng: number }

/** Valid coordinates of the first map point; country lookup stays behind import(). */
const resolveFirstPointCoordinates = (travel: Travel): FirstPointCoordinates | undefined => {
  const point = travel.travelAddress?.[0] as { coord?: string; lat?: number; lng?: number } | undefined
  if (!point) return undefined

  let lat = typeof point.lat === 'number' ? point.lat : NaN
  let lng = typeof point.lng === 'number' ? point.lng : NaN
  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && point.coord) {
    const [a, b] = point.coord.split(',').map((s) => Number(s.trim()))
    lat = a
    lng = b
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined
  return { lat, lng }
}

/**
 * Keep the 47 KB country-outline payload out of the travel route's eager graph.
 * The trip planner is its synchronous owner; sharing the same sync dependency
 * from this already-deferred section makes Metro hoist it into both HTML routes.
 */
const useResolvedCountryCode = (travel: Travel, enabled: boolean): string | undefined => {
  const raw = String((travel as any).countryCode ?? '').trim().toUpperCase()
  const coordinates = useMemo(() => resolveFirstPointCoordinates(travel), [travel])
  const lookupKey = coordinates ? `${raw}|${coordinates.lat}|${coordinates.lng}` : `${raw}|none`
  const [derived, setDerived] = useState<{ key: string; code?: string }>({ key: '', code: undefined })

  const explicit = /^[A-Z]{2}$/.test(raw) ? raw : undefined

  useEffect(() => {
    if (!enabled || explicit || !coordinates) return

    let active = true
    void import('@/utils/geoCountry')
      .then(({ getCountryCodeByCoords }) => {
        if (!active) return
        const fromPoint = getCountryCodeByCoords(coordinates.lat, coordinates.lng)
        const declared = raw.includes(',') ? raw.split(',').map((code) => code.trim()) : null
        const code = declared && fromPoint && !declared.includes(fromPoint) ? undefined : fromPoint
        setDerived({ key: lookupKey, code })
      })
      .catch(() => {
        if (active) setDerived({ key: lookupKey, code: undefined })
      })

    return () => {
      active = false
    }
  }, [coordinates, enabled, explicit, lookupKey, raw])

  if (explicit) return explicit
  return derived.key === lookupKey ? derived.code : undefined
}

/** ISO country code: explicit `countryCode`, else derived from the first point's coords. */
const useCountryCode = (travel: Travel, enabled: boolean): string | undefined => {
  const raw = String((travel as any).countryCode ?? '').trim()
  const resolved = useResolvedCountryCode(travel, enabled)

  // Мульти-страновой маршрут отдаёт код списком («ua, ge»). Берём страну первой
  // точки, но только если она объявлена в этом же списке: гео-таблица знает не
  // все страны, поэтому непроверенный код увёл бы читателя туда, где маршрута
  // нет. Не прошло проверку — ссылка остаётся нейтральной (homepage партнёра),
  // а копия ниже — без названия страны.
  // Первый токен списка брать нельзя: у 205 «ru, in» и 210 «ru, eg» он уводит
  // на Россию с индийского и египетского маршрута.
  if (raw.includes(',')) {
    return resolved
  }

  return resolved
}

export const AffiliateSection: React.FC<{
  travel: Travel
  styles: any
}> = ({ travel, styles }) => {
  const affiliateEnabled = isAffiliateEnabled()
  const countryCode = useCountryCode(travel, affiliateEnabled)

  // Contextual to the route's location, and off entirely until the owner
  // configures a Travelpayouts marker — so nothing ships until ready (FE-2).
  if (!affiliateEnabled) return null

  // `cityName` в данных — это адрес первой точки из обратного геокодинга
  // («Базилика Святого Стефана, 1, Szent István tér, …, 1051, Венгрия»), а не
  // название города, поэтому в подписи он не участвует: место = страна, ровно
  // как и destination самой партнёрской ссылки. Reliable location signal =
  // country code from the first map point's coords; same approach as BelkrajWidget.
  // Мульти-страновые маршруты отдают `countryName` списком («Украина, Грузия»),
  // а ссылка всегда одностранная — по countryCode. Подписать такую пару списком
  // значит пообещать одно, а привести в другое, поэтому место просто не
  // показываем: оффер остаётся, копия — без названия страны.
  const rawCountry = travel.countryName?.trim()
  const country = rawCountry && !rawCountry.includes(',') ? rawCountry : undefined
  // Гейт смотрит на сырое значение, а не на вычищенное: у мульти-странового
  // маршрута, чью первую точку гео-таблица не резолвит либо резолвит в страну
  // вне объявленного списка, и код, и `country` пусты, но блок там был и должен
  // остаться — просто с нейтральными ссылками и копией без места. Таблица знает
  // не все страны: например, Египет и Маврикий резолвятся только из явного
  // `countryCode`, координатами — нет.
  if (!countryCode && !rawCountry) return null

  // Don't render an orphan header when there are no offers to show.
  if (getAffiliateOffers({ country, countryCode, travelId: travel.id }).length === 0) return null

  const webRegionProps = Platform.OS === 'web'
    ? {
        accessibilityRole: 'region' as any,
        dataSet: { sectionKey: 'affiliate' },
      }
    : null

  const webHeadingProps = Platform.OS === 'web'
    ? {
        accessibilityRole: 'heading' as any,
        'aria-level': 2 as any,
      }
    : null

  return (
    <View
      style={[
        styles.sectionContainer,
        styles.contentStable,
        Platform.OS === 'web' ? styles.webDeferredSection : null,
      ]}
      collapsable={false}
      accessibilityLabel={i18nT('travel:components.travel.details.sections.AffiliateSection.poleznoe_v_poezdku_e14de6ad')}
      {...(webRegionProps ?? {})}
    >
      <Text
        style={styles.sectionHeaderText}
        {...(webHeadingProps ?? {})}
      >{i18nT('travel:components.travel.details.sections.AffiliateSection.poleznoe_v_poezdku_e14de6ad')}</Text>
      <Text style={styles.sectionSubtitle}>{i18nT('travel:components.travel.details.sections.AffiliateSection.ekskursii_i_zhile_ryadom_s_marshrutom_84c0332c')}</Text>

      <View style={{ marginTop: 12 }}>
        <AffiliateOffers
          country={country}
          countryCode={countryCode}
          travelId={travel.id}
        />
      </View>
    </View>
  )
}

export default React.memo(AffiliateSection)
