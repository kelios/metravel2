import React from 'react'
import { Platform, Text, type StyleProp, type TextStyle } from 'react-native'

import { translate as i18nT } from '@/i18n'
import { formatDate } from '@/i18n/format'
import { readTravelContentUpdatedAt } from '@/utils/travelContentUpdatedAt'

type TravelUpdatedLineProps = {
  travel: object | null | undefined
  style?: StyleProp<TextStyle>
}

// UTC: серверный HTML и первый клиентский кадр должны дать одну и ту же дату.
const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }

/**
 * #3237: видимая строка «Обновлено <дата>». Дата — только честная дата правки
 * содержания из адаптера `readTravelContentUpdatedAt`; нет даты — нет строки.
 * На web дата размечена `<time dateTime>`.
 */
export default function TravelUpdatedLine({ travel, style }: TravelUpdatedLineProps) {
  const iso = readTravelContentUpdatedAt(travel)
  if (!iso) return null
  const date = formatDate(iso, DATE_OPTIONS)
  return (
    <Text style={style} testID="travel-updated-line">
      {i18nT('travel:components.travel.details.TravelUpdatedLine.label')}{' '}
      {Platform.OS === 'web' ? <time dateTime={iso}>{date}</time> : date}
    </Text>
  )
}
