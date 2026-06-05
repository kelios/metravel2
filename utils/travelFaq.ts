import type { Travel, TravelAddressItem } from '@/types/types'

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
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} день`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} дня`
  return `${n} дней`
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
      q: 'Где находится это место и как туда добраться?',
      a: `Маршрут проходит по направлению: ${place}. Точные координаты всех точек и интерактивная карта маршрута есть ниже на странице — по ней удобно построить дорогу из вашего города.`,
    })
  }

  // 2. Длительность
  if (typeof travel.number_days === 'number' && travel.number_days > 0) {
    items.push({
      q: 'Сколько времени закладывать на поездку?',
      a: `Автор прошёл этот маршрут примерно за ${pluralizeDays(travel.number_days)}. Это ориентир из реальной поездки — при желании темп можно растянуть или сократить под свой график.`,
    })
  }

  // 3. Сезон
  if (month) {
    items.push({
      q: 'В какое время года лучше ехать?',
      a: `Автор путешествовал здесь в ${month}${year ? ` ${year} года` : ''}. Описание и фотографии сделаны именно в этот сезон — ориентируйтесь на них, чтобы понять, как место выглядит в это время.`,
    })
  }

  // 4. Что посмотреть (точки маршрута)
  const pointNames = Array.isArray(travel.travelAddress)
    ? travel.travelAddress.map(getPointName).filter(Boolean)
    : []
  if (pointNames.length > 0) {
    const shown = pointNames.slice(0, MAX_POINTS_IN_ANSWER)
    const tail = pointNames.length > shown.length ? ` и ещё ${pointNames.length - shown.length}` : ''
    items.push({
      q: 'Что обязательно посмотреть на этом маршруте?',
      a: clamp(
        `Ключевые точки маршрута: ${shown.join('; ')}${tail}. У каждой есть координаты и фото в разделе с картой — можно пройти весь маршрут или выбрать только то, что интересно.`,
      ),
    })
  }

  // 5. Плюсы / минусы — стоит ли ехать
  const plus = nonEmpty(travel.plus) ? stripHtml(travel.plus) : ''
  const minus = nonEmpty(travel.minus) ? stripHtml(travel.minus) : ''
  if (plus || minus) {
    const parts: string[] = []
    if (plus) parts.push(`Плюсы по мнению автора: ${plus}`)
    if (minus) parts.push(`На что обратить внимание: ${minus}`)
    items.push({
      q: 'Стоит ли сюда ехать? Плюсы и минусы',
      a: clamp(parts.join(' ')),
    })
  }

  // 6. Рекомендации автора
  const recommendation = nonEmpty(travel.recommendation) ? stripHtml(travel.recommendation) : ''
  if (recommendation) {
    items.push({
      q: 'Что советует автор перед поездкой?',
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
      q: 'Кто составил маршрут и можно ли задать вопрос?',
      a: `Маршрут собран автором ${author} по личной поездке, а не скопирован из путеводителя. Если остался вопрос — спросите автора в комментариях ниже, обычно отвечают и делятся деталями.`,
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
