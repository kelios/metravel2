import React, { memo, useCallback, useMemo } from 'react'

import ExternalContentLinkCard from '@/components/ui/ExternalContentLinkCard'
import { translate as i18nT } from '@/i18n'
import { openExternalUrl } from '@/utils/externalLinks'
import {
  canRenderBelkrajWidget,
  parseBelkrajCoord,
  resolveBelkrajCountryCode,
} from './belkrajAvailability'
import { buildBelkrajWidgetUrl } from './belkrajWidgetUrl'

interface TravelAddress {
  id: number
  address: string
  coord?: string
  lat?: number
  lng?: number
}

type Props = {
  points: TravelAddress[]
  countryCode?: string
  cardsCount?: number
  /**
   * Паритет контракта с web-вариантом (BelkrajWidget.tsx): tsconfig
   * moduleSuffixes резолвит типы в .native, поэтому web-вызовы с className,
   * высотами и прокруткой (questWizardSections, ExcursionsSection) должны
   * типизироваться. На native карточке-ссылке не используются.
   */
  collapsedHeight?: number
  expandedHeight?: number
  allowScroll?: boolean
  className?: string
}

/**
 * Подборка экскурсий belkraj.by на native — карточка-ссылка во внешний браузер,
 * без WebView (#2135, App Review 5.1.2(i)).
 *
 * Документ виджета `belkraj.by/partner/widget` сам подключает Google Tag Manager
 * партнёра (`GTM-TXS6S84`; на 03.10.2026 контейнер пуст, но теги в него партнёр
 * публикует без нашего релиза), а страницы экскурсий — GTM с Facebook Pixel,
 * Google Ads, GA4, VK и Яндексом и cookie `Drupal.visitor.utm_*`. Внутри
 * приложения это сторонний трекинг без ATT, поэтому подборку для той же точки
 * пользователь открывает в браузере, где cookies и согласие — дело браузера и
 * сайта партнёра. Web (iframe в `BelkrajWidget.tsx`) не меняется.
 */
function BelkrajWidget({ points, countryCode, cardsCount = 6 }: Props) {
  // Гейт тот же, что спрашивают секции вокруг виджета: расходиться им нельзя.
  const canRender = useMemo(
    () => canRenderBelkrajWidget(points, countryCode),
    [countryCode, points],
  )

  const partnerUrl = useMemo(() => {
    const coord = parseBelkrajCoord(points?.[0])
    if (!coord) return null
    return buildBelkrajWidgetUrl({
      coord,
      countryCode: resolveBelkrajCountryCode(points, countryCode),
      cardsCount,
    })
  }, [cardsCount, countryCode, points])

  const openPartnerPage = useCallback(() => {
    if (partnerUrl) void openExternalUrl(partnerUrl, { allowedProtocols: ['https:'] })
  }, [partnerUrl])

  if (!canRender || !partnerUrl) return null

  return (
    <ExternalContentLinkCard
      testID="belkraj-native-link-card"
      eyebrow="belkraj.by"
      title={i18nT('shared:components.belkraj.BelkrajWidget.nativeLinkTitle')}
      caption={i18nT('shared:components.belkraj.BelkrajWidget.nativeLinkCaption')}
      onPress={openPartnerPage}
    />
  )
}

export default memo(BelkrajWidget)
