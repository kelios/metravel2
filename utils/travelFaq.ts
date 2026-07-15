import type { Travel, TravelAddressItem } from '@/types/types'
import { selectPlural, translate as i18nT } from '@/i18n'


/**
 * Генерация блока «Частые вопросы» (FAQ) для страницы путешествия.
 *
 * Принцип: НИЧЕГО не выдумываем. Каждый вопрос появляется только если под ответ
 * есть реальные данные самого путешествия (город, страна, длительность, сезон,
 * точки маршрута, плюсы/минусы, автор). Так блок честен перед читателем и даёт
 * валидную FAQPage-микроразметку без накрутки.
 */

export type TravelFaqItem = {
  q: string
  a: string
}

const MAX_ANSWER_LENGTH = 600
const MAX_POINTS_IN_ANSWER = 7

const stripHtml = (raw: string): string =>
  raw
    .replace(/<\s*(br|\/p|\/div|\/li)\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&laquo;/gi, '«')
    .replace(/&raquo;/gi, '»')
    .replace(/&mdash;/gi, '—')
    .replace(/\s+/g, ' ')
    .trim()

const clamp = (text: string, max = MAX_ANSWER_LENGTH): string => {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return (lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : cut.trimEnd() + '…')
}

const pluralizeDays = (n: number): string => {
  return selectPlural(n, {
    one: i18nT('shared:utils.travelFaq.value1_den_76898066', { value1: n }),
    few: i18nT('shared:utils.travelFaq.value1_dnya_7827b4d5', { value1: n }),
    many: i18nT('shared:utils.travelFaq.value1_dney_afdb77ec', { value1: n }),
    other: i18nT('shared:utils.travelFaq.value1_dney_afdb77ec', { value1: n }),
  })
}

const getPointName = (item: TravelAddressItem): string => {
  if (typeof item === 'string') return item.trim()
  if (item && typeof item === 'object' && typeof item.name === 'string') return item.name.trim()
  return ''
}

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

/** Строит список FAQ-пар из данных путешествия. Может вернуть пустой массив. */
export function buildTravelFaqItems(travel: Travel | null | undefined): TravelFaqItem[] {
  if (!travel) return []

  const items: TravelFaqItem[] = []
  const city = nonEmpty(travel.cityName) ? travel.cityName.trim() : ''
  const country = nonEmpty(travel.countryName) ? travel.countryName.trim() : ''
  const month = nonEmpty(travel.monthName) ? travel.monthName.trim().toLowerCase() : ''
  const year = nonEmpty(travel.year) ? travel.year.trim() : ''

  // 1. Где находится
  const place = [city, country].filter(Boolean).join(', ')
  if (place) {
    items.push({
      q: i18nT('shared:utils.travelFaq.gde_nahoditsya_eto_mesto_i_kak_tuda_dobratsy_b4e75471'),
      a: i18nT('shared:utils.travelFaq.marshrut_prohodit_po_napravleniyu_value1_toc_092dde6e', { value1: place }),
    })
  }

  // 2. Длительность
  if (typeof travel.number_days === 'number' && travel.number_days > 0) {
    items.push({
      q: i18nT('shared:utils.travelFaq.skolko_vremeni_zakladyvat_na_poezdku_33650fb5'),
      a: i18nT('shared:utils.travelFaq.avtor_proshel_etot_marshrut_primerno_za_valu_eeaa927a', { value1: pluralizeDays(travel.number_days) }),
    })
  }

  // 3. Сезон
  if (month) {
    items.push({
      q: i18nT('shared:utils.travelFaq.v_kakoe_vremya_goda_luchshe_ehat_76cf62ef'),
      a: i18nT('shared:utils.travelFaq.avtor_puteshestvoval_zdes_v_value1_value2_op_9afc9c6f', { value1: month, value2: year ? ` ${year} года` : '' }),
    })
  }

  // 4. Что посмотреть (точки маршрута)
  const pointNames = Array.isArray(travel.travelAddress)
    ? travel.travelAddress.map(getPointName).filter(Boolean)
    : []
  if (pointNames.length > 0) {
    const shown = pointNames.slice(0, MAX_POINTS_IN_ANSWER)
    const tail = pointNames.length > shown.length ? i18nT('shared:utils.travelFaq.i_esche_value1_a40205f6', { value1: pointNames.length - shown.length }) : ''
    items.push({
      q: i18nT('shared:utils.travelFaq.chto_obyazatelno_posmotret_na_etom_marshrute_24f75df4'),
      a: clamp(
        i18nT('shared:utils.travelFaq.klyuchevye_tochki_marshruta_value1_value2_u__3daa077c', { value1: shown.join('; '), value2: tail }),
      ),
    })
  }

  // 5. Плюсы / минусы — стоит ли ехать
  const plus = nonEmpty(travel.plus) ? stripHtml(travel.plus) : ''
  const minus = nonEmpty(travel.minus) ? stripHtml(travel.minus) : ''
  if (plus || minus) {
    const parts: string[] = []
    if (plus) parts.push(i18nT('shared:utils.travelFaq.plyusy_po_mneniyu_avtora_value1_aa11625f', { value1: plus }))
    if (minus) parts.push(i18nT('shared:utils.travelFaq.na_chto_obratit_vnimanie_value1_8a705ba5', { value1: minus }))
    items.push({
      q: i18nT('shared:utils.travelFaq.stoit_li_syuda_ehat_plyusy_i_minusy_f423767e'),
      a: clamp(parts.join(' ')),
    })
  }

  // 6. Рекомендации автора
  const recommendation = nonEmpty(travel.recommendation) ? stripHtml(travel.recommendation) : ''
  if (recommendation) {
    items.push({
      q: i18nT('shared:utils.travelFaq.chto_sovetuet_avtor_pered_poezdkoy_d0f9d015'),
      a: clamp(recommendation),
    })
  }

  // 7. Автор маршрута — драйвер вовлечения
  const author = nonEmpty(travel.user?.name)
    ? travel.user!.name.trim()
    : nonEmpty(travel.userName)
      ? travel.userName.trim()
      : ''
  if (author) {
    items.push({
      q: i18nT('shared:utils.travelFaq.kto_sostavil_marshrut_i_mozhno_li_zadat_vopr_2e5bd908'),
      a: i18nT('shared:utils.travelFaq.marshrut_sobran_avtorom_value1_po_lichnoy_po_96c49924', { value1: author }),
    })
  }

  return items
}

/**
 * FAQPage JSON-LD из готовых пар. Возвращает null, если вопросов меньше двух —
 * для одного вопроса микроразметка бессмысленна.
 */
export function buildTravelFaqJsonLd(
  items: TravelFaqItem[],
): Record<string, unknown> | null {
  if (!Array.isArray(items) || items.length < 2) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  }
}
